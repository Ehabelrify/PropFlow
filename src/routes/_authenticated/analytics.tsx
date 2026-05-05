import { createFileRoute } from "@tanstack/react-router";
import { useRole } from "@/lib/role-context";
import { useAuth } from "@/lib/auth-context";
import { useLeads, useProfiles } from "@/hooks/use-supabase";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";
import { ClientChart } from "@/components/crm/ClientChart";
import { PIPELINE_STAGES, formatCurrency } from "@/lib/mock-data";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — PropFlow CRM" }, { name: "description", content: "Pipeline conversion, lead source attribution, and agent performance." }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { scopedLeads } = useRole();
  const { profile } = useAuth();
  const { data: profiles = [] } = useProfiles(profile?.tenant_id ?? undefined);

  const sourceCount: Record<string, number> = {};
  scopedLeads.forEach(l => sourceCount[l.source] = (sourceCount[l.source] || 0) + 1);
  const sourceData = Object.entries(sourceCount).map(([source, count]) => ({ source, count }));

  const agentPerf = (profiles as any[]).map(u => {
    const owned = scopedLeads.filter(l => l.assignedTo === u.id);
    const displayName = u.name ? u.name.split(" ")[0] : "Unknown";
    return { name: displayName, leads: owned.length, won: owned.filter(l => l.stage === "won").length };
  });

  const funnel = PIPELINE_STAGES.filter(s => s.id !== "lost").map(s => ({
    stage: s.label,
    count: scopedLeads.filter(l => l.stage === s.id).length,
  }));

  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--info)"];

  return (
    <div>
      <PageHeader title="Analytics" description="Pipeline performance and team insights." />
      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <Card className="p-5 shadow-card lg:col-span-2">
          <h3 className="text-sm font-semibold">Monthly trends</h3>
          <p className="text-xs text-muted-foreground">Historical lead and revenue data</p>
          <div className="flex h-60 flex-col items-center justify-center text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">No historical data yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Monthly trends will populate as you track activity over time</p>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="text-sm font-semibold">Conversion funnel</h3>
          <p className="text-xs text-muted-foreground">Leads at each pipeline stage</p>
          <ClientChart height={256}>
            <ResponsiveContainer>
              <BarChart data={funnel} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ClientChart>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="text-sm font-semibold">Lead sources</h3>
          <p className="text-xs text-muted-foreground">Where your leads are coming from</p>
          {sourceData.length > 0 ? (
            <ClientChart height={256}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={sourceData} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {sourceData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ClientChart>
          ) : (
            <div className="flex h-60 flex-col items-center justify-center text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">No lead source data yet</p>
            </div>
          )}
        </Card>

        <Card className="p-5 shadow-card lg:col-span-2">
          <h3 className="text-sm font-semibold">Agent performance</h3>
          <p className="text-xs text-muted-foreground">Leads owned vs leads won per agent</p>
          <ClientChart height={256}>
            <ResponsiveContainer>
              <BarChart data={agentPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="leads" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="won" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ClientChart>
        </Card>
      </div>
    </div>
  );
}
