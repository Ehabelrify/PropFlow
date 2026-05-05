import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, MapPin, Calendar as CalIcon } from "lucide-react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/role-context";
import { useAuth } from "@/lib/auth-context";
import { useAppointments, useUpdateAppointment, useProperties, useProfiles } from "@/hooks/use-supabase";
import { format } from "date-fns";
import { ScheduleVisitDialog } from "@/components/crm/dialogs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({ meta: [{ title: "Appointments — PropFlow CRM" }] }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const { scopedLeads } = useRole();
  const { profile } = useAuth();
  const { data: profiles = [] } = useProfiles(profile?.tenant_id ?? undefined);
  const { data: properties = [] } = useProperties();
  const updateAppointment = useUpdateAppointment();
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed" | "cancelled" | "no_show">("all");

  const leadIds = new Set(scopedLeads.map(l => l.id));
  const { data: appointments = [] } = useAppointments();
  const filtered = useMemo(() => {
    return (appointments as any[]).filter(a => {
      if (filter !== "all" && a.status !== filter) return false;
      if (!leadIds.has(a.lead_id)) return false;
      return true;
    }).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }, [appointments, filter, leadIds]);

  const statusColors: Record<string, string> = {
    scheduled: "bg-info/15 text-info border-info/30",
    completed: "bg-success/15 text-success border-success/30",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
    no_show: "bg-warning/15 text-warning-foreground border-warning/30",
  };

  const setStatus = (id: string, status: string) => {
    updateAppointment.mutate({ id, status: status as any });
    toast.success(`Appointment ${status}`);
  };

  return (
    <div>
      <PageHeader
        title="Appointments"
        description={`${filtered.length} appointments`}
        actions={<ScheduleVisitDialog trigger={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> Schedule visit</Button>} />}
      />
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
          {(["all", "scheduled", "completed", "cancelled", "no_show"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${filter === f ? `bg-primary text-primary-foreground shadow-sm` : `text-muted-foreground hover:bg-muted hover:text-foreground`}`}>
              {f.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(a => {
            const lead = (scopedLeads || []).find(l => l.id === a.lead_id);
            const prop = (properties || []).find(p => p.id === a.property_id);
            const agent = (profiles || []).find((p: any) => p.id === a.assigned_to);
            const isUpcoming = a.status === "scheduled" && new Date(a.scheduled_at) > new Date();

            return (
              <Card key={a.id} className={`p-5 shadow-card ${isUpcoming ? `ring-1 ring-info/30` : ``}`}>
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <CalIcon className="h-5 w-5" />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize border ${statusColors[a.status]}`}>{a.status.replace(`_`, ` `)}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold">{a.title}</h3>
                <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalIcon className="h-3.5 w-3.5" />
                    {format(new Date(a.scheduled_at), "EEEE, MMM d · h:mm a")}
                  </div>
                  <span>{a.duration_min} min</span>
                  {a.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      {a.location}
                    </div>
                  )}
                  {lead && <div>Lead: <span className="font-medium text-foreground">{lead.name}</span></div>}
                  {prop && <div>Property: <span className="font-medium text-foreground">{prop.title}</span></div>}
                  {agent && <div>Agent: <span className="font-medium text-foreground">{agent.name}</span></div>}
                </div>
                {a.notes && <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{a.notes}</p>}
                {a.status === "scheduled" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setStatus(a.id, "completed")}>Mark completed</Button>
                    <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={() => setStatus(a.id, "cancelled")}>Cancel</Button>
                  </div>
                )}
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground">No appointments match this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}
