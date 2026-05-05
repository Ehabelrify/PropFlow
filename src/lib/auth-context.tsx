import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    let tenantStatus: string | null = null;
    if ((p as Profile)?.tenant_id) {
      const { data: t } = await supabase.from("tenants").select("status").eq("id", (p as Profile).tenant_id).maybeSingle();
      tenantStatus = t?.status ?? null;
    }
    setProfile({ ...(p as Profile), tenant_status: tenantStatus } ?? null);
    setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
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
      tenantPending: profile?.tenant_status === "pending_approval" || profile?.tenant_status === "rejected",
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