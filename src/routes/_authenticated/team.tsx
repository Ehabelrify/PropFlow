import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Mail, Copy, Check, Plus, KeyRound, Trash2, UserCog, Users, AlertTriangle, Building2 } from "lucide-react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { useRole } from "@/lib/role-context";
import { ORG_ROLE_LABEL } from "@/lib/role-context";
import { useLeads, useProfiles, useTeams, useTenants, useTenant, useInvitations, useCreateInvitation, useRevokeInvitation, useUpdateUserRole, useAssignTeam, useCreateTeam } from "@/hooks/use-supabase";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { Team, OrgRole } from "@/lib/types";

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatar_color: string;
  team_id: string | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
  user_roles?: Array<{ role: OrgRole }>;
};

type TeamWithLeader = Team & {
  leader?: { id: string; name: string; initials: string; avatar_color: string } | null;
  tenant?: { name: string } | null;
};

type InvitationRow = {
  id: string;
  code: string;
  tenant_id: string;
  team_id: string | null;
  is_active: boolean;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
};

type LeadRow = {
  id: string;
  assigned_to?: string | null;
  owner_id?: string | null;
  stage: string;
  budget?: number;
};

const NO_TEAM_VALUE = "__none__";

export const Route = createFileRoute("/_authenticated/team")({
  beforeLoad: async ({ context }) => {
    const { auth } = context;
    
    // Only managers, leaders, and super_admins can manage team - check auth roles
    const hasAccess = auth?.roles?.some((role: string) =>
      ["manager", "leader", "super_admin"].includes(role)
    );
    
    if (!hasAccess) {
      throw redirect({ to: "/" });
    }
    
    return {};
  },
  head: () => ({ meta: [{ title: "Team — PropFlow CRM" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { profile } = useAuth();
  const { orgRole } = useRole();
  const isSuperAdmin = orgRole === "super_admin";
  const isManager = orgRole === "manager";
  const isLeader = orgRole === "leader";
  const isAgent = orgRole === "agent";

  // Super admin sees all; manager sees only their tenant; leader sees all but can only invite to own team
  const tenantId = profile?.tenant_id ?? undefined;
  // Super admin should see all profiles (pass undefined), others see their tenant
  const { data: profiles = [] } = useProfiles(isSuperAdmin ? undefined : tenantId);
  const { data: teams = [] } = useTeams(isSuperAdmin ? undefined : tenantId);
  const { data: allTenants = [] } = useTenants();
  const { data: currentTenant } = useTenant(tenantId);
  const { data: invitations = [] } = useInvitations(tenantId);
  const { data: leads = [] } = useLeads(tenantId ? { tenant_id: tenantId } : undefined);
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();
  const updateRole = useUpdateUserRole();
  const assignTeam = useAssignTeam();
  const createTeam = useCreateTeam();

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteTeamId, setInviteTeamId] = useState<string>(isLeader && profile?.team_id ? profile.team_id : NO_TEAM_VALUE);
  const [teamDialog, setTeamDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editTeam, setEditTeam] = useState<string>(NO_TEAM_VALUE);
  const [processing, setProcessing] = useState(false);

  const usedSeats = isManager ? profiles.length : 0;
  const totalSeats = (currentTenant as { seats?: number })?.seats ?? 5;
  const atCapacity = usedSeats >= totalSeats;

  const teamMap = new Map((teams as TeamWithLeader[]).map((t) => [t.id, t]));

  // Precompute lead stats once - O(leads) instead of O(users × leads)
  const leadsByOwner = useMemo(() => {
    const map = new Map<string, LeadRow[]>();
    (leads ?? []).forEach((lead: LeadRow) => {
      const ownerId = lead.assigned_to || lead.owner_id;
      if (ownerId) {
        if (!map.has(ownerId)) map.set(ownerId, []);
        map.get(ownerId)!.push(lead);
      }
    });
    return map;
  }, [leads]);

  const userStats = useMemo(() => {
    const stats = new Map<string, { total: number; won: number; wonValue: number }>();
    leadsByOwner.forEach((userLeads, userId) => {
      const wonLeads = userLeads.filter((l) => l.stage === "won");
      const wonValue = wonLeads.reduce((sum, l) => sum + (l.budget || 0), 0);
      stats.set(userId, {
        total: userLeads.length,
        won: wonLeads.length,
        wonValue,
      });
    });
    return stats;
  }, [leadsByOwner]);

  // Group profiles by team
  const profilesByTeam = useMemo(() => {
    const grouped: Record<string, ProfileRow[]> = { unassigned: [] };
    (profiles as ProfileRow[]).forEach((u) => {
      const tid = u.team_id;
      if (tid && teamMap.has(tid)) {
        if (!grouped[tid]) grouped[tid] = [];
        grouped[tid].push(u);
      } else {
        grouped.unassigned.push(u);
      }
    });
    return grouped;
  }, [profiles, teamMap]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success("Code copied");
  };

  const handleCreateInvite = () => {
    if (!profile?.tenant_id) {
      toast.error("No tenant assigned to your profile");
      return;
    }
    const teamId = inviteTeamId === NO_TEAM_VALUE ? null : inviteTeamId;
    createInvitation.mutate({
      tenant_id: profile.tenant_id,
      team_id: teamId,
      expires_in_hours: 168
    }, {
      onSuccess: () => {
        toast.success("Invitation code created");
        setInviteTeamId(isLeader && profile?.team_id ? profile.team_id : NO_TEAM_VALUE);
      },
      onError: (error: Error) => {
        toast.error(`Failed to create invitation: ${error.message || "Unknown error"}`);
      },
    });
  };

  const handleRevoke = (id: string) => {
    if (!profile?.tenant_id) return;
    revokeInvitation.mutate({ id, tenant_id: profile.tenant_id }, {
      onSuccess: () => toast.success("Invitation revoked"),
    });
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    setProcessing(true);
    const promises: Promise<void>[] = [];
    if (editRole && editRole !== editingUser.user_roles?.[0]?.role) {
      promises.push(new Promise<void>((resolve) => {
        updateRole.mutate({ userId: editingUser.id, role: editRole as any }, { onSettled: () => resolve() });
      }));
    }
    const currentTeam = editingUser.team_id ?? null;
    const newTeam = editTeam === NO_TEAM_VALUE ? null : editTeam;
    if (newTeam !== currentTeam) {
      promises.push(new Promise<void>((resolve) => {
        assignTeam.mutate({ userId: editingUser.id, teamId: newTeam }, { onSettled: () => resolve() });
      }));
    }
    Promise.all(promises).then(() => {
      toast.success("User updated");
      setEditingUser(null);
      setProcessing(false);
    });
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) {
      toast.error("Please enter a team name");
      return;
    }
    if (!profile?.tenant_id) {
      toast.error("No tenant assigned to your profile. Cannot create team.");
      return;
    }
    createTeam.mutate({
      id: `tm_${Date.now()}`,
      tenant_id: profile.tenant_id,
      name: newTeamName.trim(),
      leader_id: profile.id,
    }, {
      onSuccess: () => {
        toast.success("Team created");
        setTeamDialog(false);
        setNewTeamName("");
      },
      onError: (error: Error) => {
        toast.error(`Failed to create team: ${error.message || "Unknown error"}`);
      },
    });
  };

  const handleInviteToTeam = (teamId: string) => {
    // Leaders can only invite to their own team
    if (isLeader) {
      setInviteTeamId(profile?.team_id || NO_TEAM_VALUE);
    } else {
      setInviteTeamId(teamId);
    }
    setInviteDialog(true);
  };

  const renderAgentCard = (u: ProfileRow) => {
    const role = (u.user_roles?.[0]?.role ?? "agent") as OrgRole;
    // Use precomputed stats instead of filtering leads
    const stats = userStats.get(u.id) || { total: 0, won: 0, wonValue: 0 };

    return (
      <Card key={u.id} className="border border-border/60 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${u.avatar_color ?? "bg-chart-1"} text-xs font-semibold text-white`}>
              {u.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{u.name}</p>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                role === "manager" ? "bg-primary/10 text-primary" :
                role === "leader" ? "bg-info/10 text-info" :
                role === "super_admin" ? "bg-destructive/10 text-destructive" :
                "bg-muted text-muted-foreground"
              }`}>{ORG_ROLE_LABEL[role]}</span>
            </div>
          </div>
          {/* Only managers and super admins can edit users */}
          {(isManager || isSuperAdmin) && role !== "super_admin" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"><UserCog className="h-3 w-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditingUser(u); setEditRole(role); setEditTeam(u.team_id ?? NO_TEAM_VALUE); }}>
                  <UserCog className="mr-2 h-3.5 w-3.5" /> Edit role & team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <a href={`mailto:${u.email}`} className="hover:text-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</a>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniStat label="Leads" value={String(stats.total)} />
          <MiniStat label="Won" value={String(stats.won)} />
          <MiniStat label="Value" value={stats.wonValue > 0 ? `EGP ${(stats.wonValue / 1_000_000).toFixed(1)}M` : "—"} />
        </div>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title="Team"
        description={
          isSuperAdmin ? "All teams across all tenants." :
          isAgent ? "View teams in your organization." :
          isLeader ? "Manage your team members." :
          "Manage members, teams, and invitation codes."
        }
        actions={
          <div className="flex gap-2">
            {/* Invite codes button - visible to managers and leaders */}
            {(isManager || isLeader) && (
              <Button size="sm" variant="outline" onClick={() => { 
                // Leaders: pre-select their team
                if (isLeader && profile?.team_id) {
                  setInviteTeamId(profile.team_id);
                } else {
                  setInviteTeamId(NO_TEAM_VALUE); 
                }
                setInviteDialog(true); 
              }}>
                <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Invite codes
              </Button>
            )}
            {/* New team button - only for managers */}
            {isManager && (
              <Button size="sm" variant="outline" onClick={() => setTeamDialog(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New team
              </Button>
            )}
          </div>
        }
      />

      {/* Seat usage - only for manager, not super admin or agent/leader */}
      {isManager && (
        <Card className="mx-6 mb-4 p-4 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Seat usage</p>
                <p className="text-xs text-muted-foreground">{usedSeats} of {totalSeats} seats used</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-48 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-gradient-brand transition-all" style={{ width: `${Math.min((usedSeats / totalSeats) * 100, 100)}%` }} />
              </div>
              {atCapacity && (
                <Badge variant="destructive" className="text-[10px]">
                  <AlertTriangle className="mr-1 h-3 w-3" /> Full
                </Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Teams and Agents */}
      <div className="flex flex-col gap-6 p-6">
        {(teams as TeamWithLeader[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">No teams yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isManager
                ? "Create your first team to start organizing agents."
                : "No teams have been created yet."}
            </p>
            {isManager && (
              <Button className="mt-4 bg-gradient-brand text-primary-foreground" onClick={() => setTeamDialog(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Create first team
              </Button>
            )}
          </div>
        ) : (
          (teams as TeamWithLeader[]).map((team) => {
            const teamProfiles = profilesByTeam[team.id] || [];
            const tenantName = team.tenant?.name;
            const displayName = isSuperAdmin && tenantName
              ? `${team.name} — ${tenantName}`
              : team.name;
            
            // Leaders can only see invite button for their own team
            const canInviteToTeam = isManager || (isLeader && team.id === profile?.team_id);
            
            return (
              <Card key={team.id} className="overflow-hidden shadow-card">
                <div className="border-b bg-muted/30 px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">{displayName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {team.leader?.name ? `Led by ${team.leader.name}` : "No leader assigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {teamProfiles.length} agent{teamProfiles.length !== 1 ? "s" : ""}
                      </Badge>
                      {canInviteToTeam && (
                        <Button size="sm" variant="outline" onClick={() => handleInviteToTeam(team.id)}>
                          <KeyRound className="mr-1.5 h-3 w-3" /> Invite
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  {teamProfiles.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground mb-3">No agents assigned to this team yet.</p>
                      {canInviteToTeam && (
                        <Button size="sm" variant="outline" onClick={() => handleInviteToTeam(team.id)}>
                          <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Invite agents
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {teamProfiles.map(u => renderAgentCard(u))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}

        {/* Unassigned agents - only visible to managers and super admins */}
        {!isAgent && !isLeader && profilesByTeam.unassigned?.length > 0 && (
          <Card className="overflow-hidden shadow-card border-dashed">
            <div className="border-b bg-muted/30 px-5 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-muted-foreground">Unassigned</h3>
                  <p className="text-xs text-muted-foreground">Agents not assigned to any team</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {profilesByTeam.unassigned.length} agent{profilesByTeam.unassigned.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
            <div className="p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {profilesByTeam.unassigned.map(u => renderAgentCard(u))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Edit user dialog - only for managers and super admins */}
      <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit member</DialogTitle>
            <DialogDescription>Change role and team assignment.</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4">
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="leader">Team Leader</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Team</Label>
                <Select value={editTeam} onValueChange={setEditTeam}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="No team" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEAM_VALUE}>No team</SelectItem>
                    {(teams as TeamWithLeader[]).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={processing} className="bg-gradient-brand text-primary-foreground">
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create team dialog - only for managers */}
      {isManager && (
        <Dialog open={teamDialog} onOpenChange={setTeamDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New team</DialogTitle>
              <DialogDescription>Create a team to organize agents.</DialogDescription>
            </DialogHeader>
            <div>
              <Label className="text-xs">Team name</Label>
              <Input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Residential Sales" className="mt-1" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setTeamDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()} className="bg-gradient-brand text-primary-foreground">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Invite codes dialog */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitation codes</DialogTitle>
            <DialogDescription>Share codes with agents to join your workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Team selection - disabled for leaders */}
            <div>
              <Label className="text-xs">Team (optional)</Label>
              {isLeader ? (
                <div className="mt-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  {(teams as TeamWithLeader[]).find((t) => t.id === profile?.team_id)?.name || "Your team"}
                  <p className="mt-1 text-[11px] text-muted-foreground">Agents will be assigned to your team</p>
                </div>
              ) : (
                <Select value={inviteTeamId} onValueChange={setInviteTeamId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="No specific team (tenant-wide)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEAM_VALUE}>No team (tenant-wide)</SelectItem>
                    {(teams as TeamWithLeader[]).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!isLeader && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {inviteTeamId !== NO_TEAM_VALUE
                    ? "Agent will be assigned to this team upon joining"
                    : "Agent can be assigned to a team later by a manager"}
                </p>
              )}
            </div>
            {(invitations as InvitationRow[]).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="font-mono text-sm font-semibold">{inv.code}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {inv.is_active ? `Expires ${formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}` : "Revoked"}
                    {inv.team_id && ` · ${(teams as TeamWithLeader[]).find((t) => t.id === inv.team_id)?.name || 'Unknown team'}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  {inv.is_active && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyCode(inv.code)}>
                      {copiedCode === inv.code ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  {/* Only managers can revoke invitations */}
                  {(isManager || isSuperAdmin) && inv.is_active && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRevoke(inv.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {(invitations as InvitationRow[]).length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No invitation codes yet.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCreateInvite} disabled={atCapacity || (isLeader && !profile?.team_id)} className="bg-gradient-brand text-primary-foreground">
              <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Generate code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2 text-center">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
