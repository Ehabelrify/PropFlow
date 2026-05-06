import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

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
    try {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);

      const activeSession = currentSession ?? session;

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

        setProfile(
          newProfile ? { ...newProfile, tenant_status: null } : null
        );

        setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
        return;
      }

      let tenantStatus: string | null = null;

      if ((p as Profile)?.tenant_id) {
        const { data: t } = await supabase
          .from("tenants")
          .select("status")
          .eq("id", (p as Profile).tenant_id!)
          .maybeSingle();

        tenantStatus = t?.status ?? null;
      }

      const profileData = p as Profile;

      setProfile(
        profileData
          ? { ...profileData, tenant_status: tenantStatus }
          : null
      );

      setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
    } catch (error) {
      console.error("Error loading profile:", error);
      setProfile(null);
      setRoles([]);
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let mounted = true;

    // 🔥 Auth state listener (NO LOOP VERSION)
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        if (newSession?.user?.id) {
          loadProfile(newSession.user.id, newSession);
        } else {
          setProfile(null);
          setRoles([]);
        }
      }
    );

    // Initial session load
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      setSession(data.session);

      if (data.session?.user?.id) {
        loadProfile(data.session.user.id, data.session);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refresh = async () => {
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  };

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    isAuthed: !!session,
    hasRole: (r) => roles.includes(r),
    refresh,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    tenantPending:
      profile?.tenant_status === "pending_approval" ||
      profile?.tenant_status === "rejected",
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  leader: "Team Leader",
  agent: "Agent",
};