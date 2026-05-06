import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { User, Lead } from "./types";
import { useAuth, type AppRole } from "./auth-context";
import type { Database } from "@/types/database";

export function orgRoleOf(u: User | null | undefined): "super_admin" | "manager" | "leader" | "agent" {
  if (!u) return "agent";
  if (u.role === "super_admin") return "super_admin";
  if (u.role === "agent") return "agent";
  if (u.role === "manager" && u.teamId) return "leader";
  return "manager";
}

type DbLead = Database["public"]["Tables"]["leads"]["Row"];

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
    "leads.create", "leads.update_own",
    "analytics.view_team", "analytics.view_tenant",
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

function dbLeadToMockLead(db: DbLead): Lead {
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
    requirements: db.requirements ?? {},
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    lastActivityAt: db.last_activity_at,
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
      role: primaryRole === "leader" ? "manager" : (primaryRole === "super_admin" ? "super_admin" : primaryRole === "manager" ? "manager" : "agent"),
      avatarColor: profile?.avatar_color ?? "bg-chart-1",
      initials: profile?.initials ?? (session.user.email?.[0]?.toUpperCase() ?? "?"),
      tenantId: profile?.tenant_id ?? undefined,
      teamId: profile?.team_id ?? undefined,
    };
  }, [profile, authRoles, session?.user]);

  const user = authUser;

  let orgRole: OrgRole = "agent";
  if (user) {
    orgRole = authRoles.includes("super_admin") ? "super_admin" :
             authRoles.includes("manager") ? "manager" :
             authRoles.includes("leader") ? "leader" : "agent";
  }

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

    const perms = new Set(ROLE_PERMS[orgRole]);
    const has = (p: Permission) => perms.has(p);

    // scopedLeads now empty - data fetching moved to route-level
    const scopedLeads: Lead[] = [];
    
    // Keep scopeLabel logic based on role
    let scopeLabel = "";
    if (orgRole === "super_admin") {
      scopeLabel = "Platform-wide";
    } else if (orgRole === "manager") {
      scopeLabel = "All teams";
    } else if (orgRole === "leader") {
      scopeLabel = "My team";
    } else {
      scopeLabel = "All leads";
    }

    return { user, orgRole, setUserId, has, scopedLeads, scopeLabel };
  }, [user, orgRole]);

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
