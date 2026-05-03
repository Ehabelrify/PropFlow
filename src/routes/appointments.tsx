import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, MapPin } from "lucide-react";
import { useStore } from "@/lib/data-store";
import { PageHeader } from "@/components/crm/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/crm/Avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { ScheduleVisitDialog } from "@/components/crm/dialogs";
import { toast } from "sonner";

export const Route = createFileRoute("/appointments")({
  head: () => ({ meta: [{ title: "Appointments — PropFlow CRM" }, { name: "description", content: "Schedule and track property visits." }] }),
  component: AppointmentsPage,
});

const statusTone: Record<string, string> = {
  scheduled: "bg-info/10 text-info",
  completed: "bg-success/15 text-success",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-destructive/10 text-destructive",
};

function AppointmentsPage() {
  const { appointments, leads, properties, users, setAppointmentStatus } = useStore();
  const sorted = [...appointments].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const groups = sorted.reduce((acc, a) => {
    const d = new Date(a.scheduledAt);
    let key = format(d, "EEEE, MMM d");
    if (isToday(d)) key = `Today · ${format(d, "EEEE, MMM d")}`;
    else if (isTomorrow(d)) key = `Tomorrow · ${format(d, "EEEE, MMM d")}`;
    else if (isPast(d)) key = `Past · ${format(d, "EEEE, MMM d")}`;
    (acc[key] ||= []).push(a);
    return acc;
  }, {} as Record<string, typeof sorted>);

  return (
    <div>
      <PageHeader title="Appointments" description="Property visits and customer meetings." actions={<ScheduleVisitDialog trigger={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> New Visit</Button>} />} />
      <div className="space-y-6 p-6">
        {Object.entries(groups).map(([day, items]) => (
          <div key={day}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map(a => {
                const lead = leads.find(l => l.id === a.leadId);
                const property = properties.find(p => p.id === a.propertyId);
                const owner = users.find(u => u.id === a.assignedTo);
                return (
                  <Card key={a.id} className="p-4 shadow-card transition hover:shadow-elevated">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{format(new Date(a.scheduledAt), "h:mm a")} · {a.durationMin}m</p>
                        {lead && <Link to="/leads/$leadId" params={{ leadId: lead.id }} className="mt-0.5 block text-sm font-semibold hover:text-primary">{lead.name}</Link>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone[a.status]}`}>{a.status.replace("_", " ")}</button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(["scheduled", "completed", "cancelled", "no_show"] as const).map(s => (
                            <DropdownMenuItem key={s} onClick={() => { setAppointmentStatus(a.id, s); toast.success(`Marked ${s.replace("_", " ")}`); }}>
                              <span className="capitalize">{s.replace("_", " ")}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {property && <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{property.title}</p>}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {a.location}</div>
                      {owner && <UserAvatar userId={owner.id} />}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
