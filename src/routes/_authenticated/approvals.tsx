import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, CheckCircle2, XCircle, Clock, Mail, Key, UserCog, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useRole } from "@/lib/role-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { UserAvatar } from "@/components/crm/Avatar";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "Approvals — PropFlow CRM" }] }),
  component: ApprovalsPage,
});

const KIND_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  password: <Key className="h-4 w-4" />,
  role: <UserCog className="h-4 w-4" />,
};

const KIND_LABELS: Record<string, string> = {
  email: "Email change",
  password: "Password reset",
  role: "Role change",
};

function ApprovalsPage() {
  const { profile, refresh: refreshAuth } = useAuth();
  const { has } = useRole();
  const [note, setNote] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Fetch approval requests
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("*, requester:profiles!approval_requests_requester_id_fkey(name, avatar_color, initials)")
        .eq("tenant_id", profile?.tenant_id ?? "")
        .order("created_at", { ascending: false });
      if (!error && data) setRequests(data);
      setLoading(false);
    })();
  });

  const filtered = requests.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    return true;
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  const decide = async (id: string, status: "approved" | "rejected") => {
    if (!profile) return;
    setProcessing(id);
    const { error } = await supabase
      .from("approval_requests")
      .update({ status, decided_by: profile.id, decided_at: new Date().toISOString(), decision_note: note[id] || null })
      .eq("id", id);
    setProcessing(null);
    if (error) return toast.error(error.message);
    toast.success(`Request ${status}`);
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status, decided_by: profile.id, decided_at: new Date().toISOString(), decision_note: note[id] || null } : r));

    // Refresh auth if role was changed
    if (status === "approved" && r.kind === "role") {
      await refreshAuth();
    }
  };

  if (!has("tenant.manage_team")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <Card className="max-w-md p-8 text-center shadow-card">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">Manager access required</h2>
          <p className="mt-1 text-sm text-muted-foreground">Only managers and super admins can review approvals.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        description={`${pendingCount} pending request${pendingCount !== 1 ? `s` : ``} requiring your review.`}
      />
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${filter === f ? `bg-primary text-primary-foreground shadow-sm` : `text-muted-foreground hover:bg-muted hover:text-foreground`}`}>
              {f}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <Card className="p-12 text-center shadow-card">
            <Shield className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <h3 className="mt-3 text-sm font-semibold">No approval requests</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {filter === "pending" ? "All caught up!" : "No requests match this filter."}
            </p>
          </Card>
        )}

        <div className="space-y-3">
          {filtered.map(r => {
            const statusColor = r.status === "pending" ? "border-warning/30 bg-warning/5" :
              r.status === "approved" ? "border-success/30 bg-success/5" :
              "border-destructive/30 bg-destructive/5";

            return (
              <Card key={r.id} className={`p-5 shadow-card border ${statusColor}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      r.status === "pending" ? "bg-warning/15 text-warning" :
                      r.status === "approved" ? "bg-success/15 text-success" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {KIND_ICONS[r.kind] ?? <Clock className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{KIND_LABELS[r.kind] ?? r.kind}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          r.status === "pending" ? "bg-warning/15 text-warning" :
                          r.status === "approved" ? "bg-success/15 text-success" :
                          "bg-destructive/10 text-destructive"
                        }`}>{r.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested by {r.requester?.name ?? "Unknown"} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                      {r.reason && (
                        <p className="mt-1 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                          Reason: {r.reason}
                        </p>
                      )}
                      {r.decision_note && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Note: {r.decision_note}
                        </p>
                      )}
                      {r.decided_at && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Decided {format(new Date(r.decided_at), "MMM d, h:mm a")}
                        </p>
                      )}
                    </div>
                  </div>

                  {r.status === "pending" && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Textarea
                        value={note[r.id] || ""}
                        onChange={e => setNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Add a note..."
                        rows={2}
                        className="w-56 text-xs min-h-[50px]"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-success text-white hover:bg-success/90" disabled={processing === r.id} onClick={() => decide(r.id, "approved")}>
                          {processing === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30" disabled={processing === r.id} onClick={() => decide(r.id, "rejected")}>
                          {processing === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
