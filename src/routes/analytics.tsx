import { createFileRoute } from "@tanstack/react-router";
import { LEADS, USERS, PIPELINE_STAGES, formatCurrency } from "@/lib/mock-data";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — PropFlow CRM" }, { name: "description", content: "Pipeline conversion, lead source attribution, and agent performance." }] }),
  component: AnalyticsPage,
});

const monthly = [
  { month: "Nov", leads: 84, won: 12, value: 64 },
  { month: "Dec", leads: 102, won: 17, value: 88 },
  { month: "Jan", leads: 118, won: 19, value: 96 },
  { month: "Feb", leads: 96, won: 14, value: 72 },
  { month: "Mar", leads: 134, won: 23, value: 124 },
  { month: "Apr", leads: 152, won: 28, value: 142 },
];

function AnalyticsPage() {
  const sourceCount: Record<string, number> = {};
  LEADS.forEach(l => sourceCount[l.source] = (sourceCount[l.source] || 0) + 1);
  const sourceData = Object.entries(sourceCount).map(([source, count]) => ({ source, count }));

  const agentPerf = USERS.filter(u => u.role === "agent" || u.role === "manager").map(u => {
    const owned = LEADS.filter(l => l.assignedTo === u.id);
    return { name: u.name.split(" ")[0], leads: owned.length, won: owned.filter(l => l.stage === "won").length };
  });

  const funnel = PIPELINE_STAGES.filter(s => s.id !== "lost").map(s => ({
    stage: s.label,
    count: LEADS.filter(l => l.stage === s.id).length,
  }));

  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--info)"];

  return (
    <div>
      <PageHeader title="Analytics" description="Pipeline performance and team insights." />
      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <Card className="p-5 shadow-card lg:col-span-2">
          <h3 className="text-sm font-semibold">Lead trend & wins</h3>
          <p className="text-xs text-muted-foreground">Monthly leads, conversions and revenue (in millions EGP)</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="leads" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="won" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="value" stroke="var(--chart-4)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="text-sm font-semibold">Conversion funnel</h3>
          <p className="text-xs text-muted-foreground">Leads at each pipeline stage</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={funnel} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="text-sm font-semibold">Lead sources</h3>
          <p className="text-xs text-muted-foreground">Where your leads are coming from</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={sourceData} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {sourceData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 shadow-card lg:col-span-2">
          <h3 className="text-sm font-semibold">Agent performance</h3>
          <p className="text-xs text-muted-foreground">Leads owned vs leads won per agent</p>
          <div className="mt-4 h-64">
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
          </div>
        </Card>
      </div>
    </div>
  );
}
