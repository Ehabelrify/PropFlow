import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Phone, Copy, Check, Plus, KeyRound, Trash2, UserCog, Users, Shield, AlertTriangle } from "lucide-react";
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
import { useProfiles, useTeams, useTenant, useInvitations, useCreateInvitation, useRevokeInvitation, useUpdateUserRole, useAssignTeam } from "@/hooks/use-supabase";
import { useCreateTeam } from "@/hooks/use-supabase";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — PropFlow CRM" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { profile, roles } = useAuth();
  const { has, scopedLeads, orgRole } = useRole();
  const { data: profiles = [] } = useProfiles(profile?.tenant_id ?? undefined);
  const { data: teams = [] } = useTeams(profile?.tenant_id ?? undefined);
  const { data: tenant } = useTenant(profile?.tenant_id ?? undefined);
  const { data: invitations = [] } = useInvitations(profile?.tenant_id ?? undefined);
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();
  const updateRole = useUpdateUserRole();
  const assignTeam = useAssignTeam();
  const createTeam = useCreateTeam();

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [inviteDialog, setInviteDialog] = useState(false);
  const [teamDialog, setTeamDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editTeam, setEditTeam] = useState<string>("");
  const [processing, setProcessing] = useState(false);

  const isManager = orgRole === "manager" || orgRole === "super_admin";
  const usedSeats = (profiles as any[]).length;
  const totalSeats = (tenant as any)?.seats ?? 5;
  const atCapacity = usedSeats >= totalSeats;

  const teamMap = new Map((teams as any[]).map((t: any) => [t.id, t.name]));

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success("Code copied");
  };

  const handleCreateInvite = () => {
    if (!profile?.tenant_id) return;
    createInvitation.mutate({ tenant_id: profile.tenant_id, expires_in_hours: 168 }, {
      onSuccess: () => toast.success("Invitation code created"),
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
    const promises: Promise<any>[] = [];
    if (editRole && editRole !== editingUser.user_roles?.[0]?.role) {
      promises.push(new Promise<void>((resolve) => {
        updateRole.mutate({ userId: editingUser.id, role: editRole as any }, { onSettled: () => resolve() });
      }));
    }
    const currentTeam = editingUser.team_id ?? null;
    if (editTeam !== currentTeam) {
      promises.push(new Promise<void>((resolve) => {
        assignTeam.mutate({ userId: editingUser.id, teamId: editTeam || null }, { onSettled: () => resolve() });
      }));
    }
    Promise.all(promises).then(() => {
      toast.success("User updated");
      setEditingUser(null);
      setProcessing(false);
    });
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim() || !profile?.tenant_id) return;
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
    });
  };

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage members, teams, and invitation codes."
        actions={
          <div className="flex gap-2">
            {isManager && (
              <>
                <Button size="sm" variant="outline" onClick={() => setInviteDialog(true)}>
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Invite codes
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTeamDialog(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New team
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Seat usage */}
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

      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {(profiles as any[]).map(u => {
          const role = (u.user_roles?.[0]?.role ?? "agent") as "super_admin" | "manager" | "leader" | "agent";
          const teamName = u.team_id ? teamMap.get(u.team_id) : null;
          const ownedLeads = scopedLeads.filter(l => l.assignedTo === u.id);
          const wonLeads = ownedLeads.filter(l => l.stage === "won");
          const wonValue = wonLeads.reduce((s, l) => s + l.budget, 0);

          return (
            <Card key={u.id} className="p-5 shadow-card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${u.avatar_color ?? "bg-chart-1"} text-sm font-semibold text-white`}>
                    {u.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{u.name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        role === "manager" ? "bg-primary/10 text-primary" :
                        role === "leader" ? "bg-info/10 text-info" :
                        role === "super_admin" ? "bg-destructive/10 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>{ORG_ROLE_LABEL[role]}</span>
                      {teamName && <span>· {teamName}</span>}
                    </div>
                  </div>
                </div>
                {isManager && role !== "super_admin" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><UserCog className="h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditingUser(u); setEditRole(role); setEditTeam(u.team_id ?? ""); }}>
                        <UserCog className="mr-2 h-3.5 w-3.5" /> Edit role & team
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <a href={`mailto:${u.email}`} className="hover:text-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</a>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <MiniStat label="Leads" value={String(ownedLeads.length)} />
                <MiniStat label="Won" value={String(wonLeads.length)} />
                <MiniStat label="Value" value={wonValue > 0 ? `EGP ${(wonValue / 1_000_000).toFixed(1)}M` : "—"} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Edit user dialog */}
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
                    <SelectItem value="">No team</SelectItem>
                    {(teams as any[]).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
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

      {/* Create team dialog */}
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

      {/* Invite codes dialog */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitation codes</DialogTitle>
            <DialogDescription>Share codes with agents to join your workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(invitations as any[]).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="font-mono text-sm font-semibold">{inv.code}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {inv.is_active ? `Expires ${formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}` : "Revoked"}
                  </p>
                </div>
                <div className="flex gap-1">
                  {inv.is_active && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyCode(inv.code)}>
                      {copiedCode === inv.code ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  {inv.is_active && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRevoke(inv.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {(invitations as any[]).length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No invitation codes yet.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCreateInvite} disabled={atCapacity} className="bg-gradient-brand text-primary-foreground">
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
