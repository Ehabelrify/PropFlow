import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

const db = supabase as any;

export type AppRole = "super_admin" | "manager" | "leader" | "agent";

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_color: string;
  initials: string;
  tenant_id: string | null;
  team_id: string | null;
  tenant_status?: string | null;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isAuthed: boolean;
  hasRole: (r: AppRole) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  tenantPending: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ prevents double-init loops (CRITICAL FIX)
  const initialized = useRef(false);

  const loadProfile = async (uid: string, currentSession?: Session | null) => {
    const startTime = performance.now();
    console.log(`[AUTH] loadProfile START for uid: ${uid}`, { timestamp: new Date().toISOString() });
    
    try {
      console.log(`[AUTH] Fetching profile and roles from Supabase...`);
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      console.log(`[AUTH] Profile/roles fetched successfully`, { profile: p, rolesCount: (r ?? []).length, duration: `${(performance.now() - startTime).toFixed(2)}ms` });

      const activeSession = currentSession;

      // Prepare all data first, then batch state updates
      let profileToSet: Profile | null = null;
      let rolesToSet: AppRole[] = [];

      // create profile if missing
      if (!p && activeSession?.user) {
        const { data: newProfile } = await supabase
          .from("profiles")
          .insert({
            id: uid,
            name: activeSession.user.email?.split("@")[0] || "User",
            email: activeSession.user.email || "",
            avatar_color: "bg-chart-1",
            initials: activeSession.user.email?.[0]?.toUpperCase() || "?",
          })
          .select()
          .single();

        profileToSet = newProfile ? { ...newProfile, tenant_status: null } : null;
        rolesToSet = ((r ?? []) as { role: AppRole }[]).map((x) => x.role);
      } else {
        let tenantStatus: string | null = null;

        if ((p as Profile)?.tenant_id) {
          const { data: t } = await db
            .from("tenants")
            .select("status")
            .eq("id", (p as Profile).tenant_id!)
            .maybeSingle();

          tenantStatus = t?.status ?? null;
        }

        const profileData = p as Profile;
        profileToSet = profileData ? { ...profileData, tenant_status: tenantStatus } : null;
        rolesToSet = ((r ?? []) as { role: AppRole }[]).map((x) => x.role);
      }

      // Batch state updates in a single microtask to prevent React error #185
      console.log(`[AUTH] Batching state updates...`);
      Promise.resolve().then(() => {
        setProfile(profileToSet);
        setRoles(rolesToSet);
        console.log(`[AUTH] loadProfile COMPLETE`, { duration: `${(performance.now() - startTime).toFixed(2)}ms` });
      });
    } catch (error) {
      console.error("Error loading profile:", error);
      Promise.resolve().then(() => {
        setProfile(null);
        setRoles([]);
      });
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let mounted = true;
    let authStateChangeCount = 0;
    let initialLoadDone = false;

    // 🔥 Auth state listener (NO LOOP VERSION)
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        authStateChangeCount++;
        console.log(`[AUTH] onAuthStateChange fired (#${authStateChangeCount}) - event: ${_event}`, { 
          hasSession: !!newSession, 
          userId: newSession?.user?.id,
          timestamp: new Date().toISOString()
        });
        
        if (!mounted) return;

        // Defer state updates to next microtask to prevent React error #185
        // when router is rendering during auth state changes
        Promise.resolve().then(() => {
          if (!mounted) return;
          
          setSession(newSession);
          console.log(`[AUTH] Session state updated`, { isAuthed: !!newSession });

          if (newSession?.user?.id) {
            // CRITICAL: defer supabase calls out of the auth callback to avoid
            // deadlocking the GoTrue lock (otherwise signIn/signOut hang forever).
            setTimeout(() => {
              if (mounted) {
                console.log(`[AUTH] Triggering loadProfile after timeout`);
                loadProfile(newSession.user.id, newSession);
              }
            }, 0);
          } else {
            // Batch clear state updates
            setProfile(null);
            setRoles([]);
            if (!initialLoadDone) {
              setLoading(false);
              initialLoadDone = true;
            }
          }
        });
      }
    );

    // Initial session load - also defer to prevent render conflicts
    console.log(`[AUTH] Getting initial session...`);
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      Promise.resolve().then(() => {
        if (!mounted) return;

        setSession(data.session);
        console.log(`[AUTH] Initial session loaded`, { hasSession: !!data.session });

        if (data.session?.user?.id) {
          setTimeout(() => {
            if (mounted) {
              console.log(`[AUTH] Triggering loadProfile from initial session`);
              loadProfile(data.session!.user.id, data.session);
            }
          }, 0);
        } else {
          // Only set loading false here if we haven't already done so via auth state change
          if (!initialLoadDone) {
            console.log(`[AUTH] Initial load complete - no session found`);
            setLoading(false);
            initialLoadDone = true;
          }
        }
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Memoize callbacks to prevent re-renders (CPU freeze fix)
  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      await loadProfile(data.session.user.id, data.session);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const hasRole = useCallback((r: AppRole) => roles.includes(r), [roles]);

  // Memoize context value to prevent unnecessary re-renders (CPU freeze fix)
  const value: AuthCtx = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    isAuthed: !!session,
    hasRole,
    refresh,
    signOut,
    tenantPending:
      profile?.tenant_status === "pending_approval" ||
      profile?.tenant_status === "rejected",
  }), [session, profile, roles, loading, hasRole, refresh, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  
  // Track every access to useAuth hook
  console.log(`[AUTH:HOOK] useAuth accessed`, { isAuthed: v.isAuthed, loading: v.loading, hasProfile: !!v.profile });
  
  return v;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  leader: "Team Leader",
  agent: "Agent",
};