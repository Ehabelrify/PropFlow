import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { USERS, LEADS, TEAMS, orgRoleOf } from "./mock-data";
import type { User, Lead } from "./types";

export type OrgRole = "super_admin" | "manager" | "leader" | "agent";

/** Permission keys used across the UI. Keep flat & predictable. */
export type Permission =
  | "platform.view"            // super-admin console
  | "platform.manage_tenants"
  | "tenant.view_all_leads"    // see every lead in tenant
  | "tenant.manage_team"       // invite users, change roles
  | "tenant.configure"         // settings, branding, widget
  | "team.view_team_leads"     // leader scope
  | "team.reassign"            // reassign within team
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

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string>("u1");
  const user = USERS.find(u => u.id === userId) ?? USERS[0];
  const orgRole = orgRoleOf(user);

  const value = useMemo<RoleContextValue>(() => {
    const perms = new Set(ROLE_PERMS[orgRole]);
    const has = (p: Permission) => perms.has(p);

    let scopedLeads: Lead[] = [];
    let scopeLabel = "";
    if (orgRole === "super_admin") {
      scopedLeads = LEADS;
      scopeLabel = "Platform-wide";
    } else if (orgRole === "manager") {
      scopedLeads = LEADS.filter(l => l.tenantId === user.tenantId);
      scopeLabel = "All teams";
    } else if (orgRole === "leader") {
      // Leader sees leads belonging to agents on their team
      const teamUserIds = new Set(USERS.filter(u => u.teamId === user.teamId).map(u => u.id));
      scopedLeads = LEADS.filter(l => l.tenantId === user.tenantId && (teamUserIds.has(l.assignedTo) || l.teamId === user.teamId));
      const team = TEAMS.find(t => t.id === user.teamId);
      scopeLabel = team ? `${team.name} team` : "My team";
    } else {
      scopedLeads = LEADS.filter(l => l.assignedTo === user.id);
      scopeLabel = "Assigned to me";
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