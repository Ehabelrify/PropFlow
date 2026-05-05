import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/data-store";
import { ORG_ROLE_LABEL } from "@/lib/role-context";
import { TEAMS, orgRoleOf } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — PropFlow CRM" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { users, leads } = useStore();

  const teamMap = new Map(TEAMS.map(t => [t.id, t.name]));

  return (
    <div>
      <PageHeader title="Team" description="Members and their performance." />
      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {users.map(u => {
          const role = orgRoleOf(u);
          const teamName = u.teamId ? teamMap.get(u.teamId) : null;
          const ownedLeads = leads.filter(l => l.assignedTo === u.id);
          const wonLeads = ownedLeads.filter(l => l.stage === "won");
          const totalValue = ownedLeads.reduce((s, l) => s + l.budget, 0);
          const wonValue = wonLeads.reduce((s, l) => s + l.budget, 0);

          return (
            <Card key={u.id} className="p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${u.avatarColor} text-sm font-semibold text-white`}>
                  {u.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{u.name}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ORG_ROLE_LABEL[role]}{teamName ? ` · ${teamName}` : ``}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <a href={`mailto:${u.email}`} className="hover:text-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</a>
                {u.role !== "super_admin" && <span className="text-muted-foreground/50">·</span>}
                {u.role !== "super_admin" && <span className="hover:text-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {u.email}</span>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <MiniStat label="Leads" value={String(ownedLeads.length)} />
                <MiniStat label="Won" value={String(wonLeads.length)} />
                <MiniStat label="Value" value={"EGP ${(wonValue / 1_000_000).toFixed(1)}M"} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2 text-center">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
