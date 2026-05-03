import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Code2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — PropFlow CRM" }, { name: "description", content: "Workspace, branding, and integrations." }] }),
  component: SettingsPage,
});

function SettingsPage() {
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

  return (
    <div>
      <PageHeader title="Settings" description="Workspace, branding, and integrations." />
      <div className="grid gap-4 p-6 lg:grid-cols-2">
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

        <Card className="p-5 shadow-card">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Code2 className="h-4 w-4" /> Embed widget</h3>
          <p className="text-xs text-muted-foreground">Drop this snippet on your website to capture leads.</p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">{widgetSnippet}</pre>
          <Button size="sm" variant="outline" className="mt-3" onClick={copy}><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy snippet</Button>
        </Card>

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
