import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Filter, Download, Plus, Phone, Mail } from "lucide-react";
import { PIPELINE_STAGES, formatCurrency, getUser } from "@/lib/mock-data";
import { useRole } from "@/lib/role-context";
import type { LeadStage } from "@/lib/types";
import { PageHeader } from "@/components/crm/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StageBadge } from "@/components/crm/StageBadge";
import { HotBadge } from "@/components/crm/HotBadge";
import { UserAvatar } from "@/components/crm/Avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads — PropFlow CRM" },
      { name: "description", content: "Filter, search and act on every lead in one inbox." },
    ],
  }),
  component: LeadsInbox,
});

function LeadsInbox() {
  const { scopedLeads, scopeLabel, has } = useRole();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<LeadStage | "all">("all");
  const [hotOnly, setHotOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return scopedLeads.filter(l => {
      if (stage !== "all" && l.stage !== stage) return false;
      if (hotOnly && !l.hot) return false;
      if (query) {
        const q = query.toLowerCase();
        return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.phone.includes(q);
      }
      return true;
    });
  }, [query, stage, hotOnly, scopedLeads]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        description={`${filtered.length} of ${scopedLeads.length} leads · ${scopeLabel}`}
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" /> Export</Button>
            {has("leads.create") && (
              <Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> New Lead</Button>
            )}
          </>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-card">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email, phone…" className="h-9 border-transparent bg-muted/50 pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button onClick={() => setStage("all")} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${stage === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>All</button>
            {PIPELINE_STAGES.map(s => (
              <button key={s.id} onClick={() => setStage(s.id)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize ${stage === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{s.label}</button>
            ))}
          </div>
          <button onClick={() => setHotOnly(!hotOnly)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${hotOnly ? "bg-hot text-hot-foreground" : "text-muted-foreground hover:bg-muted"}`}>🔥 Hot only</button>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-4 py-2 text-sm">
            <span className="font-medium text-primary">{selected.size} selected</span>
            <span className="text-muted-foreground">·</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs">Assign</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs">Move stage</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs">Export</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">Delete</Button>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2.5"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>
                <th className="px-3 py-2.5 text-left font-medium">Lead</th>
                <th className="px-3 py-2.5 text-left font-medium">Stage</th>
                <th className="px-3 py-2.5 text-left font-medium">Score</th>
                <th className="px-3 py-2.5 text-left font-medium">Budget</th>
                <th className="px-3 py-2.5 text-left font-medium">Source</th>
                <th className="px-3 py-2.5 text-left font-medium">Owner</th>
                <th className="px-3 py-2.5 text-left font-medium">Last activity</th>
                <th className="w-20 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const owner = getUser(lead.assignedTo);
                return (
                  <tr key={lead.id} className="border-t transition-colors hover:bg-muted/30">
                    <td className="px-3 py-3"><Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggle(lead.id)} /></td>
                    <td className="px-3 py-3">
                      <Link to="/leads/$leadId" params={{ leadId: lead.id }} className="group flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground group-hover:text-primary">{lead.name}</span>
                            {lead.hot && <HotBadge />}
                          </div>
                          <div className="text-xs text-muted-foreground">{lead.email}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3"><StageBadge stage={lead.stage} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${lead.score >= 75 ? "bg-success" : lead.score >= 50 ? "bg-warning" : "bg-muted-foreground/40"}`} style={{ width: `${lead.score}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{lead.score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium tabular-nums">{formatCurrency(lead.budget)}</td>
                    <td className="px-3 py-3 capitalize text-muted-foreground">{lead.source}</td>
                    <td className="px-3 py-3">{owner && <div className="flex items-center gap-2"><UserAvatar userId={owner.id} /><span className="text-xs">{owner.name.split(" ")[0]}</span></div>}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{formatDistanceToNow(new Date(lead.lastActivityAt), { addSuffix: true })}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100">
                        <Button size="icon" variant="ghost" className="h-7 w-7"><Phone className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><Mail className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">No leads match your filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}
