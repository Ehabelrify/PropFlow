import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Code2, User, Mail, Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRole } from "@/lib/role-context";
import { useStore } from "@/lib/data-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — PropFlow CRM" }, { name: "description", content: "Profile, workspace, branding, and integrations." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user: authUser, refresh } = useAuth();
  const { orgRole } = useRole();
  const { tenants } = useStore();

  // Profile editing state
  const [editName, setEditName] = useState(profile?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Approval request state
  const [editEmail, setEditEmail] = useState(authUser?.email ?? "");
  const [requestReason, setRequestReason] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [approvalKind, setApprovalKind] = useState<"email" | "role" | "password">("email");

  const [name, setName] = useState("Acme Realty Group");
  const [slug, setSlug] = useState("acme-realty");
  const [currency, setCurrency] = useState("EGP");

  const widgetSnippet = `<script src="https://cdn.propflow.app/widget.js"
  data-tenant="${slug}"
  data-key="pk_live_3f8a..."
  defer></script>`;

  const copy = async () => {
    await navigator.clipboard.writeText(widgetSnippet);
    toast.success("Snippet copied");
  };

  const saveProfile = async () => {
    if (!authUser) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: editName.trim() || editName })
      .eq("id", authUser.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    await refresh();
  };

  const requestApproval = async () => {
    if (!authUser) return;
    setRequesting(true);
    const payload: Record<string, string> = {};
    if (approvalKind === "email") payload.new_email = editEmail;

    const { error } = await supabase.from("approval_requests").insert({
      requester_id: authUser.id,
      kind: approvalKind,
      payload,
      reason: requestReason.trim() || undefined,
      tenant_id: profile?.tenant_id ?? undefined,
    });
    setRequesting(false);
    if (error) return toast.error(error.message);
    toast.success("Approval request sent");
    setRequestReason("");
  };

  return (
    <div>
      <PageHeader title="Settings" description="Profile, workspace, branding, and integrations." />
      <div className="grid gap-4 p-6 lg:grid-cols-2">

        {/* Profile Section */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Profile</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Your personal details.</p>
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs">Full name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1" placeholder="Your name" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={authUser?.email ?? ""} disabled className="mt-1 bg-muted/50" />
              <p className="mt-1 text-[11px] text-muted-foreground">Changing email requires manager approval.</p>
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <div className="mt-1 rounded-md border bg-muted/30 px-3 py-2 text-sm capitalize">{orgRole.replace("_", " ")}</div>
            </div>
            <Button size="sm" className="bg-gradient-brand text-primary-foreground" disabled={savingProfile} onClick={saveProfile}>
              {savingProfile ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save profile
            </Button>
          </div>
        </Card>

        {/* Approval Request Section */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold">Request Change</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Email, password, or role changes require manager approval.</p>
          <div className="mt-4 space-y-3">
            <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
              {(["email", "password", "role"] as const).map(k => (
                <button key={k} onClick={() => setApprovalKind(k)} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize ${approvalKind === k ? `bg-primary text-primary-foreground` : `text-muted-foreground hover:bg-muted`}`}>
                  {k}
                </button>
              ))}
            </div>

            {approvalKind === "email" && (
              <div>
                <Label className="text-xs">New email</Label>
                <div className="mt-1 flex gap-2">
                  <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="flex-1" />
                </div>
              </div>
            )}
            {approvalKind === "password" && (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning-foreground">
                A password reset link will be sent to your current email. Manager approval is required for security.
              </div>
            )}
            {approvalKind === "role" && (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning-foreground">
                Role changes (e.g. agent → leader) require manager approval. Contact your manager directly for faster processing.
              </div>
            )}

            <div>
              <Label className="text-xs">Reason <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={requestReason} onChange={e => setRequestReason(e.target.value)} className="mt-1" placeholder="Why do you need this change?" />
            </div>
            <Button size="sm" variant="outline" disabled={requesting} onClick={requestApproval}>
              {requesting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-1.5 h-3.5 w-3.5" />}
              Submit request
            </Button>
          </div>
        </Card>

        {/* Organization Section */}
        <Card className="p-5 shadow-card">
          <h3 className="text-sm font-semibold">Organization</h3>
          <p className="text-xs text-muted-foreground">Public details for your tenant.</p>
          <div className="mt-4 space-y-3">
            <div><Label className="text-xs">Company name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Workspace URL</Label><Input value={slug} onChange={e => setSlug(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Default currency</Label><Input value={currency} onChange={e => setCurrency(e.target.value)} className="mt-1" /></div>
            <Button size="sm" className="bg-gradient-brand text-primary-foreground" onClick={() => toast.success("Settings saved")}>Save changes</Button>
          </div>
        </Card>

        {/* Embed widget Section */}
        <Card className="p-5 shadow-card">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Code2 className="h-4 w-4" /> Embed widget</h3>
          <p className="text-xs text-muted-foreground">Drop this snippet on your website to capture leads.</p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">{widgetSnippet}</pre>
          <Button size="sm" variant="outline" className="mt-3" onClick={copy}><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy snippet</Button>
        </Card>

        {/* Subscription Section */}
        <Card className="p-5 shadow-card lg:col-span-2">
          <h3 className="text-sm font-semibold">Subscription</h3>
          <p className="text-xs text-muted-foreground">You're on the Professional plan.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[{ k: "Leads", v: "152 / 5,000" }, { k: "Agents", v: "5 / 25" }, { k: "Storage", v: "1.2 / 50 GB" }].map(s => (
              <div key={s.k} className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.k}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{s.v}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
