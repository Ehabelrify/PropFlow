import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useStore } from "./data-store";
import { TEAMS, orgRoleOf } from "./mock-data";
import type { User, Lead } from "./types";
import { useAuth, type AppRole } from "./auth-context";
import { useLeads, useTeams } from "@/hooks/use-supabase";
import type { Database } from "@/types/database";

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
    "analytics.view_team",
  ],
  agent: [
    "leads.create", "leads.update_own",
  ],
};

interface RoleContextValue {
  user: User;
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
  const { users, leads: mockLeads } = useStore();
  const { profile, roles: authRoles, isAuthed } = useAuth();
  const [userId, setUserId] = useState<string>("u1");

  const { data: dbLeads = [] } = useLeads();
  const { data: dbTeams = [] } = useTeams(profile?.tenant_id ?? undefined);

  const authUser = useMemo<User | null>(() => {
    if (!profile) return null;
    const primaryRole = (authRoles.length > 0 ? authRoles[0] : "agent") as OrgRole;
    return {
      id: profile.id,
      name: profile.name || profile.email.split("@")[0],
      email: profile.email,
      role: primaryRole === "leader" ? "manager" : (primaryRole === "super_admin" ? "super_admin" : primaryRole === "manager" ? "manager" : "agent"),
      avatarColor: profile.avatar_color,
      initials: profile.initials,
      tenantId: profile.tenant_id ?? undefined,
      teamId: profile.team_id ?? undefined,
    };
  }, [profile, authRoles]);

  const user = authUser ?? (users.find(u => u.id === userId) ?? users[0]);
  const isDemo = !authUser;

  let orgRole: OrgRole;
  if (isDemo) {
    orgRole = orgRoleOf(user);
  } else {
    orgRole = authRoles.length > 0 ? authRoles[0] : "agent";
  }

  const allLeads = isAuthed ? (dbLeads.length > 0 ? dbLeads.map(dbLeadToMockLead) : mockLeads) : mockLeads;

  const value = useMemo<RoleContextValue>(() => {
    const perms = new Set(ROLE_PERMS[orgRole]);
    const has = (p: Permission) => perms.has(p);

    let scopedLeads: Lead[] = [];
    let scopeLabel = "";
    if (orgRole === "super_admin") {
      scopedLeads = allLeads;
      scopeLabel = "Platform-wide";
    } else if (orgRole === "manager") {
      scopedLeads = allLeads.filter(l => l.tenantId === user.tenantId);
      scopeLabel = "All teams";
    } else if (orgRole === "leader") {
      const teamUserIds = new Set(users.filter(u => u.teamId === user.teamId).map(u => u.id));
      scopedLeads = allLeads.filter(l => l.tenantId === user.tenantId && (teamUserIds.has(l.assignedTo) || l.teamId === user.teamId));
      const team = dbTeams.find(t => t.id === user.teamId) ?? TEAMS.find(t => t.id === user.teamId);
      scopeLabel = team ? `${team.name} team` : "My team";
    } else {
      scopedLeads = isDemo ? allLeads.filter(l => l.assignedTo === user.id) : allLeads;
      scopeLabel = isDemo ? "Assigned to me" : "All my leads";
    }

    return { user, orgRole, setUserId, has, scopedLeads, scopeLabel };
  }, [user, orgRole, allLeads, users, isDemo, dbTeams]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
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
