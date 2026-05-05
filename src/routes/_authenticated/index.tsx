import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Users, Target, Calendar, Flame, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { PIPELINE_STAGES, formatCurrency } from "@/lib/mock-data";
import { useRole } from "@/lib/role-context";
import { useDashboardStats, useActivities, useAppointments, useTasks } from "@/hooks/use-supabase";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/crm/Avatar";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PropFlow CRM" },
      { name: "description", content: "Your real estate sales overview: leads, pipeline value, hot prospects, and today's activity." },
    ],
  }),
  component: Dashboard,
});

function KpiCard({
  label, value, delta, deltaPositive = true, icon: Icon, accent,
}: { label: string; value: string; delta?: string; deltaPositive?: boolean; icon: any; accent: string }) {
  return (
    <Card className="relative overflow-hidden p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          {delta && (
            <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${deltaPositive ? `text-success` : `text-destructive`}`}>
              {deltaPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta} <span className="text-muted-foreground font-normal">vs last week</span>
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const { user, orgRole, scopedLeads, scopeLabel } = useRole();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: activities = [] } = useActivities();
  const { data: appointments = [] } = useAppointments({ status: "scheduled" });
  const { data: tasks = [] } = useTasks({ status: "open" });

  const leads = scopedLeads;
  const totalLeads = stats?.totalLeads ?? leads.length;
  const hotLeads = leads.filter(l => l.hot).length;
  const wonValue = stats?.wonRevenue ?? leads.filter(l => l.stage === "won").reduce((s, l) => s + l.budget, 0);
  const pipelineValue = stats?.pipelineValue ?? leads.reduce((s, l) => s + l.budget, 0);
  const leadIds = new Set(leads.map(l => l.id));
  const upcoming = (appointments ?? []).filter(a => a.status === "scheduled" && (orgRole === "super_admin" || leadIds.has(a.lead_id) || a.assigned_to === user.id)).slice(0, 4);
  const overdueTasks = (tasks ?? []).filter(t => t.status !== "done" && new Date(t.due_at) < new Date() && (orgRole === "super_admin" || (t.lead_id && leadIds.has(t.lead_id)) || t.assigned_to === user.id));
  const recentActivity = (activities ?? []).filter(a => orgRole === "super_admin" || leadIds.has(a.lead_id)).slice(0, 6);
  const getLead = (id: string) => leads.find(l => l.id === id);

  const byStage = stats?.byStage ?? {};
  const stageBreakdown = PIPELINE_STAGES.map(s => ({
    ...s,
    count: byStage[s.id] ?? leads.filter(l => l.stage === s.id).length,
  }));

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user.name.split(` `)[0]}`}
        description={`${scopeLabel} · ${totalLeads} leads in view`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link to="/leads">View leads</Link></Button>
            <Button size="sm" className="bg-gradient-brand text-primary-foreground" asChild><Link to="/pipeline">Open pipeline</Link></Button>
          </>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total leads" value={String(totalLeads)} icon={Users} accent="bg-primary-soft text-primary" />
          <KpiCard label="Hot leads" value={String(hotLeads)} delta={totalLeads > 0 ? `${Math.round((hotLeads / totalLeads) * 100)}%` : undefined} icon={Flame} accent="bg-hot/10 text-hot" />
          <KpiCard label="Pipeline value" value={formatCurrency(pipelineValue)} icon={Target} accent="bg-info/10 text-info" />
          <KpiCard label="Won this month" value={formatCurrency(wonValue)} icon={TrendingUp} accent="bg-success/10 text-success" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 shadow-card lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Lead flow</h3>
                <p className="text-xs text-muted-foreground">Activity overview</p>
              </div>
            </div>
            <div className="flex h-56 flex-col items-center justify-center text-center">
              <Users className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">No historical data yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Charts will populate as you add leads and track activity</p>
            </div>
          </Card>

          <Card className="p-5 shadow-card">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Pipeline breakdown</h3>
              <p className="text-xs text-muted-foreground">Leads by stage</p>
            </div>
            <div className="space-y-2.5">
              {stageBreakdown.map(s => {
                const pct = totalLeads > 0 ? (s.count / totalLeads) * 100 : 0;
                return (
                  <div key={s.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground">{s.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 shadow-card lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent activity</h3>
              <Button variant="ghost" size="sm" className="text-xs">View all <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </div>
            <ul className="space-y-3">
              {recentActivity.map(a => {
                const lead = getLead(a.lead_id);
                return (
                  <li key={a.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
                    <UserAvatar userId={a.user_id} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{(a as any).user?.name ?? "Unknown"}</span>{" "}
                        <span className="text-muted-foreground">— {a.title}</span>{" "}
                        {lead && <Link to="/leads/$leadId" params={{ leadId: lead.id }} className="font-medium text-primary hover:underline">{lead.name}</Link>}
                      </p>
                      {a.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.description}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">{format(new Date(a.created_at), "MMM d, h:mm a")}</p>
                    </div>
                  </li>
                );
              })}
              {recentActivity.length === 0 && <li className="text-sm text-muted-foreground">No recent activity</li>}
            </ul>
          </Card>

          <div className="space-y-4">
            <Card className="p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-info" /> Upcoming visits</h3>
              </div>
              <ul className="space-y-2.5">
                {upcoming.map(a => {
                  const lead = getLead(a.lead_id);
                  return (
                    <li key={a.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-primary-soft text-primary">
                        <span className="text-[10px] font-medium uppercase">{format(new Date(a.scheduled_at), "MMM")}</span>
                        <span className="text-sm font-bold leading-none">{format(new Date(a.scheduled_at), "d")}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{lead?.name ?? "Unknown"}</p>
                        <p className="truncate text-xs text-muted-foreground">{format(new Date(a.scheduled_at), "h:mm a")} · {a.location}</p>
                      </div>
                    </li>
                  );
                })}
                {upcoming.length === 0 && <li className="text-sm text-muted-foreground">No upcoming visits</li>}
              </ul>
            </Card>
            <Card className="p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-warning" /> Overdue tasks</h3>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">{overdueTasks.length}</span>
              </div>
              <ul className="space-y-2">
                {overdueTasks.slice(0, 4).map(t => (
                  <li key={t.id} className="flex items-start gap-2 rounded-md p-2 hover:bg-muted/50">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{t.title}</p>
                      <p className="text-[11px] text-destructive">Due {format(new Date(t.due_at), "MMM d")}</p>
                    </div>
                  </li>
                ))}
                {overdueTasks.length === 0 && <li className="text-xs text-muted-foreground">All caught up 🎉</li>}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
