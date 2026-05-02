import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Clock, AlertCircle } from "lucide-react";
import { TASKS, getUser, getLead } from "@/lib/mock-data";
import type { TaskStatus } from "@/lib/types";
import { PageHeader } from "@/components/crm/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/crm/Avatar";
import { format, isPast } from "date-fns";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [{ title: "Tasks — PropFlow CRM" }, { name: "description", content: "Track open, in-progress, and completed tasks across your team." }] }),
  component: TasksPage,
});

function priorityTone(p: string) {
  return p === "high" ? "bg-destructive/10 text-destructive" : p === "medium" ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground";
}

function TasksPage() {
  const [filter, setFilter] = useState<TaskStatus | "all" | "overdue">("all");
  const list = TASKS.filter(t => {
    if (filter === "all") return true;
    if (filter === "overdue") return t.status !== "done" && isPast(new Date(t.dueAt));
    return t.status === filter;
  }).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const tabs: { id: typeof filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: TASKS.length },
    { id: "open", label: "Open", count: TASKS.filter(t => t.status === "open").length },
    { id: "in_progress", label: "In progress", count: TASKS.filter(t => t.status === "in_progress").length },
    { id: "overdue", label: "Overdue", count: TASKS.filter(t => t.status !== "done" && isPast(new Date(t.dueAt))).length },
    { id: "done", label: "Done", count: TASKS.filter(t => t.status === "done").length },
  ];

  return (
    <div>
      <PageHeader title="Tasks" description="Stay on top of follow-ups and to-dos." actions={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> New Task</Button>} />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1 shadow-card">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setFilter(t.id)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${filter === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {t.label} <span className="ml-1 text-xs opacity-70">{t.count}</span>
            </button>
          ))}
        </div>
        <Card className="divide-y overflow-hidden shadow-card">
          {list.map(t => {
            const owner = getUser(t.assignedTo);
            const lead = t.leadId ? getLead(t.leadId) : null;
            const overdue = t.status !== "done" && isPast(new Date(t.dueAt));
            return (
              <div key={t.id} className="flex items-center gap-3 p-4 transition hover:bg-muted/30">
                <input type="checkbox" defaultChecked={t.status === "done"} className="h-4 w-4 rounded border-border" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${priorityTone(t.priority)}`}>{t.priority}</span>
                  </div>
                  {lead && <Link to="/leads/$leadId" params={{ leadId: lead.id }} className="text-xs text-primary hover:underline">{lead.name}</Link>}
                </div>
                <div className={`flex items-center gap-1.5 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {overdue ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  {format(new Date(t.dueAt), "MMM d")}
                </div>
                {owner && <UserAvatar userId={owner.id} />}
              </div>
            );
          })}
          {list.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No tasks here.</div>}
        </Card>
      </div>
    </div>
  );
}
