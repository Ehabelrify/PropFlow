import { createContext, useContext, useMemo, useCallback, useState, type ReactNode } from "react";
import type { User, Lead } from "./types";
import { useAuth, type AppRole } from "./auth-context";
import type { Database } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeLeads } from "@/hooks/use-realtime";

export function orgRoleOf(u: User | null | undefined): "super_admin" | "manager" | "leader" | "agent" {
  if (!u) return "agent";
  if (u.role === "super_admin") return "super_admin";
  
  // Explicit leader role
  if (u.role === "leader") return "leader";
  
  // Manager role
  if (u.role === "manager") {
    // Manager with team_id is acting as a team leader
    if (u.teamId) return "leader";
    // Manager without team_id is organization manager
    return "manager";
  }
  
  // Default to agent
  return "agent";
}

type DbLead = Database["public"]["Tables"]["leads"]["Row"];

function normalizeRequirements(value: DbLead["requirements"]): Lead["requirements"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Lead["requirements"];
}

export type OrgRole = "super_admin" | "manager" | "leader" | "agent";

export type Permission =
  | "platform.view"
  | "platform.manage_tenants"
  | "tenant.view_all_leads"
  | "tenant.manage_team"
  | "tenant.configure"
  | "team.view_team_leads"
  | "team.reassign"
  | "leads.create"
  | "leads.update_own"
  | "leads.delete"
  | "analytics.view_tenant"
  | "analytics.view_team";

const ROLE_PERMS: Record<OrgRole, Permission[]> = {
  super_admin: [
    "platform.view", "platform.manage_tenants",
    "tenant.view_all_leads", "tenant.manage_team", "tenant.configure",
    "team.view_team_leads", "team.reassign",
    "leads.create", "leads.update_own", "leads.delete",
    "analytics.view_tenant", "analytics.view_team",
  ],
  manager: [
    "tenant.view_all_leads", "tenant.manage_team", "tenant.configure",
    "team.view_team_leads", "team.reassign",
    "leads.create", "leads.update_own", "leads.delete",
    "analytics.view_tenant", "analytics.view_team",
  ],
  leader: [
    "team.view_team_leads", "team.reassign",
    "leads.create", "leads.update_own", "leads.delete",
    "analytics.view_team",
  ],
  agent: [
    "leads.create", "leads.update_own",
  ],
};

interface RoleContextValue {
  user: User | null;
  orgRole: OrgRole;
  setUserId: (id: string) => void;
  has: (perm: Permission) => boolean;
  scopedLeads: Lead[];
  scopeLabel: string;
}

function dbLeadToMockLead(db: any): Lead {
  return {
    id: db.id,
    name: db.name,
    email: db.email ?? "",
    phone: db.phone ?? "",
    stage: db.stage as Lead["stage"],
    source: db.source as Lead["source"],
    budget: Number(db.budget) || 0,
    hot: db.hot,
    score: db.score,
    assignedTo: db.assigned_to ?? "",
    tenantId: db.tenant_id ?? undefined,
    teamId: db.team_id ?? undefined,
    propertyInterest: db.property_interest ?? undefined,
    tags: db.tags ?? [],
    notes: db.notes ?? "",
    requirements: normalizeRequirements(db.requirements),
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    lastActivityAt: db.last_activity_at,
    // Map joined data
    tenant: db.tenant ? {
      id: db.tenant.id,
      name: db.tenant.name,
      status: db.tenant.status,
    } : undefined,
    team: db.team ? {
      id: db.team.id,
      name: db.team.name,
    } : undefined,
    assigned_user: db.assigned_user ? {
      id: db.assigned_user.id,
      full_name: db.assigned_user.full_name,
      email: db.assigned_user.email,
      avatar_url: db.assigned_user.avatar_url,
    } : undefined,
  };
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { profile, roles: authRoles, isAuthed, session } = useAuth();
  const [userId, setUserId] = useState<string>("");

  const authUser = useMemo<User | null>(() => {
    if (!session?.user) return null;
    const primaryRole = authRoles.includes("super_admin") ? "super_admin" :
                      authRoles.includes("manager") ? "manager" :
                      authRoles.includes("leader") ? "leader" : "agent";
    return {
      id: profile?.id ?? session.user.id,
      name: (profile?.name || session.user.email?.split("@")[0]) ?? "User",
      email: profile?.email ?? session.user.email ?? "",
      role: primaryRole, // Fixed: Use primaryRole directly without remapping
      avatarColor: profile?.avatar_color ?? "bg-chart-1",
      initials: profile?.initials ?? (session.user.email?.[0]?.toUpperCase() ?? "?"),
      tenantId: profile?.tenant_id ?? undefined,
      teamId: profile?.team_id ?? undefined,
    };
  }, [profile, authRoles, session?.user]);

  const user = authUser;

  // Memoize orgRole calculation to prevent re-renders (CPU freeze fix)
  const orgRole: OrgRole = useMemo(() => {
    if (!user) return "agent";
    return authRoles.includes("super_admin") ? "super_admin" :
           authRoles.includes("manager") ? "manager" :
           authRoles.includes("leader") ? "leader" : "agent";
  }, [user, authRoles]);

  // Memoize perms Set to prevent recreation on every render (CPU freeze fix)
  const perms = useMemo(() => new Set(ROLE_PERMS[orgRole]), [orgRole]);

  // Memoize has function to prevent recreation on every render (CPU freeze fix)
  const has = useCallback((p: Permission) => perms.has(p), [perms]);

  // Fetch leads data with role-based filtering
  const { data: leadsData = [], isLoading } = useQuery({
    queryKey: ["leads", profile?.id, profile?.role, profile?.team_id, profile?.tenant_id],
    queryFn: async () => {
      if (!profile) return [];
      
      let query = supabase.from("leads").select(`
        *,
        tenant:tenants(id, name, status),
        team:teams(id, name),
        assigned_user:users!assigned_to(id, full_name, email, avatar_url)
      `);
      
      // Determine effective role using orgRoleOf
      const effectiveRole = orgRoleOf(authUser);
      
      if (effectiveRole === "super_admin") {
        // Super admin sees all leads across all tenants
      } else if (effectiveRole === "manager") {
        // Organization-wide leads (manager without team)
        query = query.eq("tenant_id", profile.tenant_id);
      } else if (effectiveRole === "leader") {
        // Team-specific leads
        if (!profile.team_id) {
          return [];
        }
        query = query.eq("team_id", profile.team_id);
      } else {
        // Agent - assigned leads only
        query = query.eq("assigned_to", profile.id);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching leads:", error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!profile && isAuthed,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Enable real-time updates for leads based on user's scope
  useRealtimeLeads({
    tenantId: profile?.tenant_id,
    teamId: profile?.team_id,
    enabled: !!profile && isAuthed,
  });

  const scopedLeads = useMemo(
    () => leadsData.map(dbLeadToMockLead),
    [leadsData]
  );

  const scopeLabel = useMemo(() => {
    if (!authUser) return "My Leads";
    
    const effectiveRole = orgRoleOf(authUser);
    
    if (effectiveRole === "super_admin") return "All Tenants (Platform-wide)";
    if (effectiveRole === "manager") return "Organization";
    if (effectiveRole === "leader") return "Team";
    return "My Leads";
  }, [authUser]);

  const value = useMemo<RoleContextValue>(() => {
    if (!user) {
      return {
        user: null!,
        orgRole,
        setUserId,
        has: () => false,
        scopedLeads: [],
        scopeLabel: "",
      };
    }

    return { user, orgRole, setUserId, has, scopedLeads, scopeLabel };
  }, [user, orgRole, setUserId, has, scopedLeads, scopeLabel]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

// Helper to check if user has any of the given roles
export function useHasAnyRole(roles: OrgRole[]) {
  const { orgRole } = useRole();
  return roles.includes(orgRole);
}

export const ORG_ROLE_LABEL: Record<OrgRole, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  leader: "Team Leader",
  agent: "Agent",
};

export const ORG_ROLE_DESC: Record<OrgRole, string> = {
  super_admin: "Platform owner — every tenant",
  manager: "Tenant owner — all teams & settings",
  leader: "Manages one team & their leads",
  agent: "Owns leads assigned to them",
};
