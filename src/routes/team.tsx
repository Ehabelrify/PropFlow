import { createFileRoute } from "@tanstack/react-router";
import { USERS, LEADS } from "@/lib/mock-data";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Team — PropFlow CRM" }, { name: "description", content: "Manage organization members and roles." }] }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <div>
      <PageHeader title="Team" description="Members of your organization." actions={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> Invite</Button>} />
      <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {USERS.map(u => {
          const owned = LEADS.filter(l => l.assignedTo === u.id).length;
          const won = LEADS.filter(l => l.assignedTo === u.id && l.stage === "won").length;
          return (
            <Card key={u.id} className="p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${u.avatarColor} text-sm font-semibold text-white`}>{u.initials}</div>
                <div className="min-w-0">
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">{u.role.replace("_", " ")}</span>
              </div>
              <div className="mt-4 flex justify-between border-t pt-3 text-xs">
                <div><p className="text-muted-foreground">Leads</p><p className="text-base font-semibold">{owned}</p></div>
                <div><p className="text-muted-foreground">Won</p><p className="text-base font-semibold text-success">{won}</p></div>
                <div><p className="text-muted-foreground">Win rate</p><p className="text-base font-semibold">{owned > 0 ? Math.round((won / owned) * 100) : 0}%</p></div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
