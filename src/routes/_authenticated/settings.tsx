import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Code2, User, Mail, Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRole } from "@/lib/role-context";
import { useUpdateProfile, useTenant, useUpdateTenant } from "@/hooks/use-supabase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  beforeLoad: async ({ context }) => {
    // All authenticated users can access settings (for their profile)
    // Tenant-level settings are conditionally shown based on role
    return {};
  },
  head: () => ({ meta: [{ title: "Settings — PropFlow CRM" }, { name: "description", content: "Profile, workspace, branding, and integrations." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user: authUser, refresh } = useAuth();
  const { orgRole } = useRole();
  const updateProfile = useUpdateProfile();
  const { data: tenant } = useTenant(profile?.tenant_id ?? undefined);
  const updateTenant = useUpdateTenant();

  const [editName, setEditName] = useState(profile?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [editEmail, setEditEmail] = useState(authUser?.email ?? "");
  const [requestReason, setRequestReason] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [approvalKind, setApprovalKind] = useState<"email" | "role" | "password">("email");
  const [requestedRole, setRequestedRole] = useState<"leader" | "manager">("leader");

  const [orgName, setOrgName] = useState(tenant?.name ?? "");
  const [orgSlug, setOrgSlug] = useState(tenant?.slug ?? "");
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    if (profile?.name) setEditName(profile.name);
  }, [profile?.name]);

  useEffect(() => {
    if (tenant) {
      setOrgName(tenant.name);
      setOrgSlug(tenant.slug);
    }
  }, [tenant]);

  const widgetSnippet = `<script src="https://cdn.propflow.app/widget.js"
  data-tenant="${orgSlug}"
  data-key="pk_live_3f8a..."
  defer></script>`;

  const copy = async () => {
    await navigator.clipboard.writeText(widgetSnippet);
    toast.success("Snippet copied");
  };

  const saveProfile = () => {
    if (!authUser) return;
    updateProfile.mutate({
      id: authUser.id,
      name: editName.trim() || editName,
    }, {
      onSuccess: () => {
        toast.success("Profile updated");
        refresh();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const saveOrg = () => {
    if (!tenant) return;
    setSavingOrg(true);
    updateTenant.mutate({
      id: tenant.id,
      name: orgName.trim(),
      slug: orgSlug.trim(),
    }, {
      onSuccess: () => {
        toast.success("Organization saved");
        setSavingOrg(false);
      },
      onError: (e) => {
        toast.error(e.message);
        setSavingOrg(false);
      },
    });
  };

  const requestApproval = async () => {
    if (!authUser) return;
    setRequesting(true);
    const payload: Record<string, string> = {};
    if (approvalKind === "email") payload.new_email = editEmail;
    if (approvalKind === "role") payload.new_role = requestedRole;

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

  const isSuperAdmin = orgRole === "super_admin";
  const isLeader = orgRole === "leader";
  const isAgent = orgRole === "agent";
  const leadCount = tenant?.leads_count ?? 0;
  const plan = tenant?.plan ?? "free";

  return (
    <div>
      <PageHeader title="Settings" description="Profile, workspace, branding, and integrations." />
      <div className="grid gap-4 p-6 lg:grid-cols-2">

        {/* Profile Card - Visible to ALL roles */}
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
            <Button size="sm" className="bg-gradient-brand text-primary-foreground" disabled={savingProfile || updateProfile.isPending} onClick={saveProfile}>
              {updateProfile.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save profile
            </Button>
          </div>
        </Card>

        {/* Request Change Card - Visible to Agent and Leader (not Super Admin) */}
        {!isSuperAdmin && (
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
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Request role</Label>
                    <div className="mt-1 flex gap-1 rounded-lg border bg-muted/30 p-1">
                      {(["leader", "manager"] as const).map(r => (
                        <button key={r} onClick={() => setRequestedRole(r)} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize ${requestedRole === r ? `bg-primary text-primary-foreground` : `text-muted-foreground hover:bg-muted`}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning-foreground">
                    Role changes (e.g. {orgRole} → {requestedRole}) require manager approval. Contact your manager directly for faster processing.
                  </div>
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
        )}

        {/* Organization Card - Only Manager and Super Admin */}
        {!isAgent && !isLeader && (
          <Card className="p-5 shadow-card">
            <h3 className="text-sm font-semibold">Organization</h3>
            <p className="text-xs text-muted-foreground">Public details for your tenant.</p>
            <div className="mt-4 space-y-3">
              <div><Label className="text-xs">Company name</Label><Input value={orgName} onChange={e => setOrgName(e.target.value)} className="mt-1" placeholder="Your company" /></div>
              <div><Label className="text-xs">Workspace URL</Label><Input value={orgSlug} onChange={e => setOrgSlug(e.target.value)} className="mt-1" placeholder="your-slug" /></div>
              <Button size="sm" className="bg-gradient-brand text-primary-foreground" disabled={savingOrg || updateTenant.isPending} onClick={saveOrg}>
                {updateTenant.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </Card>
        )}

        {/* Widget Card - Leader and Manager/Super Admin (not Agent) */}
        {!isAgent && (
          <Card className="p-5 shadow-card">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Code2 className="h-4 w-4" /> Embed widget</h3>
            <p className="text-xs text-muted-foreground">Drop this snippet on your website to capture leads.</p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">{widgetSnippet}</pre>
            <Button size="sm" variant="outline" className="mt-3" onClick={copy}><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy snippet</Button>
          </Card>
        )}

        {/* Subscription Card - Only Manager and Super Admin */}
        {!isAgent && !isLeader && tenant && (
          <Card className="p-5 shadow-card lg:col-span-2">
            <h3 className="text-sm font-semibold">Subscription</h3>
            <p className="text-xs text-muted-foreground capitalize">You're on the {plan} plan.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Leads</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{leadCount.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Agents</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{tenant.seats}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                <p className="mt-1 text-sm font-semibold capitalize">{tenant.status}</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
