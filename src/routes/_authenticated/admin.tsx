import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Users, Activity, Ban, Plus, ShieldCheck, Server, Edit2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/role-context";
import { useTenants, useApproveTenant, usePlatformHealth } from "@/hooks/use-supabase";
import { format } from "date-fns";
import { ProvisionTenantDialog } from "@/components/crm/dialogs";
import { EditTenantDialog } from "@/components/crm/EditTenantDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { useUpdateTenant } from "@/hooks/use-supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Platform Admin — PropFlow CRM" }, { name: "description", content: "Super admin console." }] }),
  component: AdminPage,
});

function AdminPage() {
  const { has } = useRole();
  const { data: tenants = [], isLoading } = useTenants();
  const { data: health, isLoading: healthLoading } = usePlatformHealth();
  const updateTenant = useUpdateTenant();
  const approveTenant = useApproveTenant();
  const [processing, setProcessing] = useState<string | null>(null);

  if (!has("platform.view")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <Card className="max-w-md p-8 text-center shadow-card">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">Restricted area</h2>
          <p className="mt-1 text-sm text-muted-foreground">Switch role from the topbar to preview.</p>
        </Card>
      </div>
    );
  }

  const tenantsData = tenants as any[];
  const totalLeads = tenantsData.reduce((s, t) => s + (t.leads_count ?? 0), 0);
  const totalSeats = tenantsData.reduce((s, t) => s + t.seats, 0);
  const active = tenantsData.filter(t => t.status === "active").length;
  const pending = tenantsData.filter(t => t.status === "pending_approval");

  const handleApprove = (id: string, approve: boolean) => {
    setProcessing(id);
    approveTenant.mutate({ id, approve }, {
      onSuccess: () => toast.success(approve ? "Tenant approved" : "Tenant rejected"),
      onError: (e) => toast.error(e.message),
      onSettled: () => setProcessing(null),
    });
  };

  const handleStatus = (id: string, status: string) => {
    updateTenant.mutate({ id, status }, {
      onSuccess: () => toast.success(`Status updated to ${status}`),
      onError: (e) => toast.error(e.message),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading admin data...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Platform Admin"
        description="Tenants, billing plans, and platform health."
        actions={<ProvisionTenantDialog trigger={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> Provision tenant</Button>} />}
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tenants" value={String(tenantsData.length)} sub={`${active} active`} icon={Building2} accent="bg-primary-soft text-primary" />
          <StatCard label="Active seats" value={String(totalSeats)} sub="across all tenants" icon={Users} accent="bg-info/10 text-info" />
          <StatCard label="Leads stored" value={totalLeads.toLocaleString()} sub="platform-wide" icon={Activity} accent="bg-success/10 text-success" />
          <StatCard label="Issues" value={String(tenantsData.filter(t => t.status === "suspended" || t.status === "rejected").length)} sub={`${tenantsData.filter(t => t.status === "suspended").length} suspended`} icon={Ban} accent="bg-destructive/10 text-destructive" />
        </div>

        {pending.length > 0 && (
          <Card className="overflow-hidden shadow-card border-warning/30">
            <div className="flex items-center justify-between border-b border-warning/20 bg-warning/5 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" /> Pending approvals
                </h3>
                <p className="text-xs text-muted-foreground">{pending.length} workspace{pending.length > 1 ? "s" : ""} awaiting review.</p>
              </div>
            </div>
            <div className="divide-y">
              {pending.map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.slug}.propflow.app · {t.plan} plan · {t.seats} seats</p>
                      <p className="text-[11px] text-muted-foreground">Created {format(new Date(t.created_at), "MMM d, yyyy h:mm a")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="bg-success text-white hover:bg-success/90" disabled={processing === t.id} onClick={() => handleApprove(t.id, true)}>
                      {processing === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30" disabled={processing === t.id} onClick={() => handleApprove(t.id, false)}>
                      {processing === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="overflow-hidden shadow-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold">Tenants</h3>
              <p className="text-xs text-muted-foreground">All workspaces on the platform.</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Tenant</th>
                <th className="px-3 py-2.5 text-left font-medium">Plan</th>
                <th className="px-3 py-2.5 text-left font-medium">Status</th>
                <th className="px-3 py-2.5 text-left font-medium">Seats</th>
                <th className="px-3 py-2.5 text-left font-medium">Leads</th>
                <th className="px-3 py-2.5 text-left font-medium">Created</th>
                <th className="w-24 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {tenantsData.map(t => (
                <tr key={t.id} className="border-t hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-brand text-primary-foreground"><Building2 className="h-4 w-4" /></div>
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.slug}.propflow.app</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 capitalize">{t.plan}</td>
                  <td className="px-3 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-3 py-3 tabular-nums">{t.seats}</td>
                  <td className="px-3 py-3 tabular-nums">{(t.leads_count ?? 0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{format(new Date(t.created_at), "MMM d, yyyy")}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <EditTenantDialog
                        tenant={t}
                        trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Edit2 className="h-3.5 w-3.5" /></Button>}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {t.status === "pending_approval" && (
                            <>
                              <DropdownMenuItem onClick={() => handleApprove(t.id, true)}>
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-success" /> Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleApprove(t.id, false)}>
                                <XCircle className="mr-2 h-3.5 w-3.5 text-destructive" /> Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => handleStatus(t.id, "active")}>Activate</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatus(t.id, "suspended")}>Suspend</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatus(t.id, "trial")}>Mark trial</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {tenantsData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">No tenants found</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Server className="h-4 w-4" />
            Platform health
            {healthLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {healthLoading ? (
              <div className="col-span-3 flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Health score</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{health?.healthScore ?? 0}%</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Active tenants</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{health?.activeTenants ?? 0} / {health?.totalTenants ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">New leads (30d)</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{health?.recentLeads ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tasks created (30d)</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{health?.recentTasks ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Appointments (30d)</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{health?.recentAppts ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total leads</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{(health?.totalLeads ?? 0).toLocaleString()}</p>
                </div>
              </>
            )}
          </div>
          {health && (
            <p className="mt-2 text-[10px] text-muted-foreground">Last updated: {new Date(health.fetchedAt).toLocaleTimeString()}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string; sub: string; icon: any; accent: string }) {
  return (
    <Card className="p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}><Icon className="h-5 w-5" /></div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success border-success/30",
    suspended: "bg-destructive/10 text-destructive border-destructive/20",
    trial: "bg-info/10 text-info border-info/20",
    pending_approval: "bg-warning/15 text-warning border-warning/30",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${map[status] ?? "bg-muted/50 text-muted-foreground"}`}>{status.replace("_", " ")}</span>;
}
