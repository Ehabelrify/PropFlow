import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Download, Plus, Phone, Mail, Trash2, Upload } from "lucide-react";
import { PIPELINE_STAGES, formatCurrency } from "@/lib/constants";
import { useRole } from "@/lib/role-context";
import { useAuth } from "@/lib/auth-context";
import { useDeleteLead, useProfiles } from "@/hooks/use-supabase";
import type { LeadStage } from "@/lib/types";
import { PageHeader } from "@/components/crm/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StageBadge } from "@/components/crm/StageBadge";
import { HotBadge } from "@/components/crm/HotBadge";
import { UserAvatar } from "@/components/crm/Avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import { NewLeadDialog, BulkAssignDialog, BulkStageDialog, LogActivityDialog } from "@/components/crm/dialogs";
import { ImportCsvDialog } from "@/components/crm/ImportCsvDialog";
import { exportLeadsCsv } from "@/lib/export-csv";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leads/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
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
  const { profile } = useAuth();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const deleteLead = useDeleteLead();
  const { data: profiles = [] } = useProfiles(profile?.tenant_id ?? undefined);
  const [query, setQuery] = useState(q);
  const [stage, setStage] = useState<LeadStage | "all">("all");
  const [hotOnly, setHotOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const activeQuery = query || q;

  const filtered = useMemo(() => {
    return scopedLeads.filter(l => {
      if (stage !== "all" && l.stage !== stage) return false;
      if (hotOnly && !l.hot) return false;
      if (activeQuery) {
        const q = activeQuery.toLowerCase();
        return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.phone.includes(q);
      }
      return true;
    });
  }, [activeQuery, stage, hotOnly, scopedLeads]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };
  const ids = Array.from(selected);

  const handleDelete = () => {
    ids.forEach(id => deleteLead.mutate(id));
    toast.success(`${ids.length} lead${ids.length > 1 ? `s` : ``} deleted`);
    setSelected(new Set());
  };

  const getOwner = (userId: string) => {
    const profilesArray = profiles || [];
    return profilesArray.find((p: any) => p.id === userId);
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        description={`${filtered.length} of ${scopedLeads.length} leads · ${scopeLabel}`}
        actions={
          <>
            <ImportCsvDialog trigger={
              <Button variant="outline" size="sm"><Upload className="mr-1.5 h-4 w-4" /> Import CSV</Button>
            } />
            <Button variant="outline" size="sm" onClick={() => exportLeadsCsv(filtered)}>
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            {has("leads.create") && (
              <NewLeadDialog
                trigger={
                  <Button size="sm" className="bg-gradient-brand text-primary-foreground">
                    <Plus className="mr-1.5 h-4 w-4" /> New Lead
                  </Button>
                }
              />
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
              <button key={s.id} onClick={() => setStage(s.id)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize ${stage === s.id ? `bg-primary text-primary-foreground` : `text-muted-foreground hover:bg-muted`}`}>{s.label}</button>
            ))}
          </div>
          <button onClick={() => setHotOnly(!hotOnly)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${hotOnly ? `bg-hot text-hot-foreground` : `text-muted-foreground hover:bg-muted`}`}>🔥 Hot only</button>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-4 py-2 text-sm">
            <span className="font-medium text-primary">{selected.size} selected</span>
            <span className="text-muted-foreground">·</span>
            <BulkAssignDialog ids={ids} onDone={() => setSelected(new Set())} trigger={<Button variant="ghost" size="sm" className="h-7 text-xs">Assign</Button>} />
            <BulkStageDialog ids={ids} onDone={() => setSelected(new Set())} trigger={<Button variant="ghost" size="sm" className="h-7 text-xs">Move stage</Button>} />
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => exportLeadsCsv(filtered.filter(l => selected.has(l.id)))}>Export</Button>
            {has("leads.delete") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {ids.length} lead{ids.length > 1 ? "s" : ""}?</AlertDialogTitle>
                    <AlertDialogDescription>This also removes their activities, tasks, and appointments. This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
                <th className="w-24 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const owner = getOwner(lead.assignedTo);
                return (
                  <tr key={lead.id} className="group border-t transition-colors hover:bg-muted/30">
                    <td className="px-3 py-3"><Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggle(lead.id)} /></td>
                    <td className="px-3 py-3">
                      <Link to="/leads/$leadId" params={{ leadId: lead.id }} className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground hover:text-primary">{lead.name}</span>
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
                          <div className={`h-full rounded-full ${lead.score >= 75 ? `bg-success` : lead.score >= 50 ? `bg-warning` : `bg-muted-foreground/40`}`} style={{ width: `${lead.score}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{lead.score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium tabular-nums">{formatCurrency(lead.budget)}</td>
                    <td className="px-3 py-3 capitalize text-muted-foreground">{lead.source}</td>
                    <td className="px-3 py-3">{owner && <div className="flex items-center gap-2"><UserAvatar userId={owner.id} /><span className="text-xs">{owner.name.split(" ")[0]}</span></div>}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{formatDistanceToNow(new Date(lead.lastActivityAt), { addSuffix: true })}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <LogActivityDialog leadId={lead.id} type="call" title="Log call" trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Phone className="h-3.5 w-3.5" /></Button>} />
                        <LogActivityDialog leadId={lead.id} type="email" title="Log email" trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Mail className="h-3.5 w-3.5" /></Button>} />
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
