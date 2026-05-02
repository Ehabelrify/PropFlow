import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Phone, Mail, MessageCircle, Calendar, Plus, Flame, MapPin, Building2 } from "lucide-react";
import { LEADS, ACTIVITIES, TASKS, APPOINTMENTS, getLead, getUser, getProperty, formatCurrency, PIPELINE_STAGES } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StageBadge } from "@/components/crm/StageBadge";
import { HotBadge } from "@/components/crm/HotBadge";
import { UserAvatar } from "@/components/crm/Avatar";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/leads/$leadId")({
  head: ({ params }) => {
    const lead = getLead(params.leadId);
    return {
      meta: [
        { title: lead ? `${lead.name} — PropFlow CRM` : "Lead — PropFlow CRM" },
        { name: "description", content: lead ? `360° view for ${lead.name}: activity timeline, tasks, and appointments.` : "Lead detail" },
      ],
    };
  },
  notFoundComponent: () => <div className="p-12 text-center text-sm text-muted-foreground">Lead not found.</div>,
  component: LeadDetail,
});

function LeadDetail() {
  const { leadId } = Route.useParams();
  const lead = getLead(leadId);
  if (!lead) return <div className="p-12 text-center text-sm text-muted-foreground">Lead not found.</div>;
  const owner = getUser(lead.assignedTo);
  const property = getProperty(lead.propertyInterest);
  const activities = ACTIVITIES.filter(a => a.leadId === lead.id);
  const tasks = TASKS.filter(t => t.leadId === lead.id);
  const appointments = APPOINTMENTS.filter(a => a.leadId === lead.id);

  return (
    <div>
      <div className="border-b bg-gradient-subtle px-6 py-5">
        <Link to="/leads" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to leads
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand text-lg font-semibold text-primary-foreground shadow-sm">
                {lead.name.split(" ").map(n => n[0]).join("").slice(0,2)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
                  {lead.hot && <HotBadge />}
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{lead.email}</span><span>·</span><span>{lead.phone}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline"><Phone className="mr-1.5 h-3.5 w-3.5" /> Call</Button>
            <Button size="sm" variant="outline"><Mail className="mr-1.5 h-3.5 w-3.5" /> Email</Button>
            <Button size="sm" variant="outline"><MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp</Button>
            <Button size="sm" className="bg-gradient-brand text-primary-foreground"><Calendar className="mr-1.5 h-3.5 w-3.5" /> Schedule visit</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5 shadow-card">
            <h3 className="text-sm font-semibold">Pipeline stage</h3>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {PIPELINE_STAGES.filter(s => s.id !== "lost").map((s, i, arr) => {
                const currentIdx = arr.findIndex(x => x.id === lead.stage);
                const idx = i;
                const reached = idx <= currentIdx;
                return (
                  <div key={s.id} className="flex items-center">
                    <button className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition ${reached ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
                      {s.label}
                    </button>
                    {idx < arr.length - 1 && <div className={`mx-0.5 h-px w-3 ${reached && idx < currentIdx ? "bg-primary" : "bg-border"}`} />}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 shadow-card">
            <h3 className="text-sm font-semibold">Activity timeline</h3>
            <ol className="mt-4 space-y-4">
              {activities.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < activities.length - 1 && <div className="absolute left-[14px] top-7 h-full w-px bg-border" />}
                  <div className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
                    {a.type === "call" && <Phone className="h-3.5 w-3.5" />}
                    {a.type === "email" && <Mail className="h-3.5 w-3.5" />}
                    {a.type === "whatsapp" && <MessageCircle className="h-3.5 w-3.5" />}
                    {a.type === "note" && <span className="text-xs">📝</span>}
                    {a.type === "stage_change" && <span className="text-xs">→</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-medium">{a.title}</span> <span className="text-muted-foreground">by {getUser(a.userId)?.name}</span></p>
                    {a.description && <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">{format(new Date(a.createdAt), "MMM d, yyyy · h:mm a")}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 shadow-card">
            <h3 className="text-sm font-semibold">Details</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Stage</dt><dd><StageBadge stage={lead.stage} /></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Score</dt><dd className="font-medium tabular-nums">{lead.score}/100</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Budget</dt><dd className="font-medium tabular-nums">{formatCurrency(lead.budget)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Source</dt><dd className="capitalize">{lead.source}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">UTM</dt><dd className="text-xs">{lead.utmSource}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Owner</dt><dd>{owner && <div className="flex items-center gap-1.5"><UserAvatar userId={owner.id} /><span className="text-xs">{owner.name}</span></div>}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd className="text-xs">{formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}</dd></div>
            </dl>
            {lead.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {lead.tags.map(t => <span key={t} className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{t}</span>)}
              </div>
            )}
          </Card>

          {property && (
            <Card className="overflow-hidden shadow-card">
              <img src={property.image} alt={property.title} className="h-32 w-full object-cover" loading="lazy" />
              <div className="p-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Interested in</p>
                <h4 className="mt-1 text-sm font-semibold">{property.title}</h4>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {property.location}
                  <span>·</span>
                  <Building2 className="h-3 w-3" /> {property.developer}
                </div>
                <p className="mt-2 text-sm font-bold text-primary">{formatCurrency(property.price)}</p>
              </div>
            </Card>
          )}

          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tasks</h3>
              <Button size="icon" variant="ghost" className="h-7 w-7"><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            <ul className="mt-2 space-y-2">
              {tasks.length === 0 && <p className="text-xs text-muted-foreground">No tasks yet</p>}
              {tasks.map(t => (
                <li key={t.id} className="flex items-start gap-2 rounded p-1.5 hover:bg-muted/50">
                  <input type="checkbox" defaultChecked={t.status === "done"} className="mt-1 h-3.5 w-3.5 rounded border-border" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                    <p className="text-[10px] text-muted-foreground">Due {format(new Date(t.dueAt), "MMM d")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {appointments.length > 0 && (
            <Card className="p-5 shadow-card">
              <h3 className="text-sm font-semibold">Appointments</h3>
              <ul className="mt-2 space-y-2">
                {appointments.map(a => (
                  <li key={a.id} className="rounded p-1.5 text-xs hover:bg-muted/50">
                    <p className="font-medium">{format(new Date(a.scheduledAt), "MMM d, h:mm a")}</p>
                    <p className="text-muted-foreground capitalize">{a.location} · {a.status}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
