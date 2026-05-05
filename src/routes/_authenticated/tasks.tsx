import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, CheckCircle2, Clock, CircleDot } from "lucide-react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/data-store";
import { useRole } from "@/lib/role-context";
import { format, formatDistanceToNow } from "date-fns";
import { UserAvatar } from "@/components/crm/Avatar";
import { NewTaskDialog } from "@/components/crm/dialogs";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — PropFlow CRM" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { scopedLeads } = useRole();
  const { tasks, users, leads, toggleTask } = useStore();
  const [filter, setFilter] = useState<"all" | "open" | "in_progress" | "done">("all");

  const leadIds = new Set(scopedLeads.map(l => l.id));
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filter !== "all" && t.status !== filter) return false;
      if (t.leadId && !leadIds.has(t.leadId)) return false;
      return true;
    });
  }, [tasks, filter, leadIds]);

  const overdue = filtered.filter(t => t.status !== "done" && new Date(t.dueAt) < new Date());

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={`${filtered.length} tasks · ${overdue.length} overdue`}
        actions={<NewTaskDialog trigger={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> New task</Button>} />}
      />
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
          {(["all", "open", "in_progress", "done"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${filter === f ? `bg-primary text-primary-foreground shadow-sm` : `text-muted-foreground hover:bg-muted hover:text-foreground`}`}>
              {f.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map(t => {
            const lead = t.leadId ? leads.find(l => l.id === t.leadId) : null;
            const isOverdue = t.status !== "done" && new Date(t.dueAt) < new Date();
            return (
              <Card key={t.id} className={`p-4 shadow-card ${isOverdue ? `border-destructive/30` : ``}`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleTask(t.id)} className="mt-0.5">
                    {t.status === "done" ? <CheckCircle2 className="h-5 w-5 text-success" /> : t.status === "in_progress" ? <Clock className="h-5 w-5 text-warning" /> : <CircleDot className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${t.status === `done` ? `line-through text-muted-foreground` : ``}`}>{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      {lead && <span>Lead: {lead.name}</span>}
                      <span>Due {format(new Date(t.dueAt), "MMM d")}</span>
                      <span className="flex items-center gap-1">
                        <UserAvatar userId={t.assignedTo} size="sm" />
                        {users.find(u => u.id === t.assignedTo)?.name.split(" ")[0]}
                      </span>
                      {isOverdue && <span className="text-destructive font-medium">Overdue</span>}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                    t.priority === "high" ? "bg-destructive/10 text-destructive" :
                    t.priority === "medium" ? "bg-warning/15 text-warning-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>{t.priority}</span>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No tasks match this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
