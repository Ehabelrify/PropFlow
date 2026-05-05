import { createFileRoute } from "@tanstack/react-router";
import { Building2, Users, Activity, Ban, Plus, ShieldCheck, Server } from "lucide-react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/data-store";
import { useRole } from "@/lib/role-context";
import { format } from "date-fns";
import { ProvisionTenantDialog } from "@/components/crm/dialogs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Platform Admin — PropFlow CRM" }, { name: "description", content: "Super admin console." }] }),
  component: AdminPage,
});

function AdminPage() {
  const { has } = useRole();
  const { tenants, setTenantStatus } = useStore();

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

  const totalLeads = tenants.reduce((s, t) => s + t.leadsCount, 0);
  const totalSeats = tenants.reduce((s, t) => s + t.seats, 0);
  const active = tenants.filter(t => t.status === "active").length;

  return (
    <div>
      <PageHeader
        title="Platform Admin"
        description="Tenants, billing plans, and platform health."
        actions={<ProvisionTenantDialog trigger={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> Provision tenant</Button>} />}
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tenants" value={String(tenants.length)} sub={"${active} active"} icon={Building2} accent="bg-primary-soft text-primary" />
          <StatCard label="Active seats" value={String(totalSeats)} sub="across all tenants" icon={Users} accent="bg-info/10 text-info" />
          <StatCard label="Leads stored" value={totalLeads.toLocaleString()} sub="platform-wide" icon={Activity} accent="bg-success/10 text-success" />
          <StatCard label="Suspended" value={String(tenants.filter(t => t.status === "suspended").length)} sub="needs attention" icon={Ban} accent="bg-destructive/10 text-destructive" />
        </div>

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
                <th className="w-10 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
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
                  <td className="px-3 py-3 tabular-nums">{t.leadsCount.toLocaleString()}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{format(new Date(t.createdAt), "MMM d, yyyy")}</td>
                  <td className="px-3 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setTenantStatus(t.id, "active"); toast.success("Activated"); }}>Activate</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setTenantStatus(t.id, "suspended"); toast.success("Suspended"); }}>Suspend</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setTenantStatus(t.id, "trial"); toast.success("Set to trial"); }}>Mark trial</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Server className="h-4 w-4" /> Platform health</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[{ k: "API uptime (30d)", v: "99.98%" }, { k: "Avg p95 latency", v: "184 ms" }, { k: "Background jobs", v: "12 / min" }].map(s => (
              <div key={s.k} className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.k}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{s.v}</p>
              </div>
            ))}
          </div>
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

function StatusBadge({ status }: { status: "active" | "suspended" | "trial" }) {
  const map = {
    active: "bg-success/15 text-success border-success/30",
    suspended: "bg-destructive/10 text-destructive border-destructive/20",
    trial: "bg-info/10 text-info border-info/20",
  } as const;
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${map[status]}`}>{status}</span>;
}
