import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Users, Target, Calendar, Flame, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { LEADS, TASKS, APPOINTMENTS, ACTIVITIES, formatCurrency, getUser, getLead, PIPELINE_STAGES } from "@/lib/mock-data";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/crm/StageBadge";
import { HotBadge } from "@/components/crm/HotBadge";
import { UserAvatar } from "@/components/crm/Avatar";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { ClientChart } from "@/components/crm/ClientChart";
import { format } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PropFlow CRM" },
      { name: "description", content: "Your real estate sales overview: leads, pipeline value, hot prospects, and today's activity." },
    ],
  }),
  component: Dashboard,
});

const trendData = Array.from({ length: 14 }).map((_, i) => ({
  day: `D${i + 1}`,
  leads: 8 + Math.round(Math.sin(i / 2) * 4 + i * 0.6),
  won: Math.max(0, Math.round(2 + Math.sin(i / 3) * 2)),
}));

const sourceData = [
  { source: "Widget", count: 38 },
  { source: "Facebook", count: 27 },
  { source: "Google", count: 21 },
  { source: "Referral", count: 14 },
  { source: "Manual", count: 9 },
];

function KpiCard({
  label, value, delta, deltaPositive = true, icon: Icon, accent,
}: { label: string; value: string; delta: string; deltaPositive?: boolean; icon: any; accent: string }) {
  return (
    <Card className="relative overflow-hidden p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${deltaPositive ? "text-success" : "text-destructive"}`}>
            {deltaPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta} <span className="text-muted-foreground font-normal">vs last week</span>
          </div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const totalLeads = LEADS.length;
  const hotLeads = LEADS.filter(l => l.hot).length;
  const wonValue = LEADS.filter(l => l.stage === "won").reduce((s, l) => s + l.budget, 0);
  const upcoming = APPOINTMENTS.filter(a => a.status === "scheduled").slice(0, 4);
  const overdueTasks = TASKS.filter(t => t.status !== "done" && new Date(t.dueAt) < new Date());
  const recentActivity = ACTIVITIES.slice(0, 6);

  const stageBreakdown = PIPELINE_STAGES.map(s => ({
    ...s,
    count: LEADS.filter(l => l.stage === s.id).length,
  }));

  return (
    <div>
      <PageHeader
        title="Welcome back, Layla"
        description="Here's how your team is performing today."
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link to="/leads">View leads</Link></Button>
            <Button size="sm" className="bg-gradient-brand text-primary-foreground" asChild><Link to="/pipeline">Open pipeline</Link></Button>
          </>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total leads" value={String(totalLeads)} delta="+12.4%" icon={Users} accent="bg-primary-soft text-primary" />
          <KpiCard label="Hot leads" value={String(hotLeads)} delta="+3" icon={Flame} accent="bg-hot/10 text-hot" />
          <KpiCard label="Pipeline value" value={formatCurrency(LEADS.reduce((s,l) => s + l.budget, 0))} delta="+8.2%" icon={Target} accent="bg-info/10 text-info" />
          <KpiCard label="Won this month" value={formatCurrency(wonValue)} delta="-1.4%" deltaPositive={false} icon={TrendingUp} accent="bg-success/10 text-success" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 shadow-card lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Lead flow</h3>
                <p className="text-xs text-muted-foreground">New vs won — last 14 days</p>
              </div>
              <span className="text-xs text-muted-foreground">Daily</span>
            </div>
            <ClientChart height={224}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="leads" stroke="var(--chart-1)" strokeWidth={2} fill="url(#g1)" />
                  <Area type="monotone" dataKey="won" stroke="var(--chart-2)" strokeWidth={2} fill="url(#g2)" />
                </AreaChart>
              </ResponsiveContainer>
            </ClientChart>
          </Card>

          <Card className="p-5 shadow-card">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Pipeline breakdown</h3>
              <p className="text-xs text-muted-foreground">Leads by stage</p>
            </div>
            <div className="space-y-2.5">
              {stageBreakdown.map(s => {
                const pct = (s.count / totalLeads) * 100;
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
                const lead = getLead(a.leadId);
                const user = getUser(a.userId);
                return (
                  <li key={a.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
                    <UserAvatar userId={a.userId} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{user?.name}</span>{" "}
                        <span className="text-muted-foreground">— {a.title}</span>{" "}
                        {lead && <Link to="/leads/$leadId" params={{ leadId: lead.id }} className="font-medium text-primary hover:underline">{lead.name}</Link>}
                      </p>
                      {a.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.description}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">{format(new Date(a.createdAt), "MMM d, h:mm a")}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="space-y-4">
            <Card className="p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-info" /> Upcoming visits</h3>
              </div>
              <ul className="space-y-2.5">
                {upcoming.map(a => {
                  const lead = getLead(a.leadId);
                  return (
                    <li key={a.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-primary-soft text-primary">
                        <span className="text-[10px] font-medium uppercase">{format(new Date(a.scheduledAt), "MMM")}</span>
                        <span className="text-sm font-bold leading-none">{format(new Date(a.scheduledAt), "d")}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{lead?.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{format(new Date(a.scheduledAt), "h:mm a")} · {a.location}</p>
                      </div>
                    </li>
                  );
                })}
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
                      <p className="text-[11px] text-destructive">Due {format(new Date(t.dueAt), "MMM d")}</p>
                    </div>
                  </li>
                ))}
                {overdueTasks.length === 0 && <p className="text-xs text-muted-foreground">All caught up 🎉</p>}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
