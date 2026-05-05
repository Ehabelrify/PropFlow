import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2, MessageSquare, X, Send, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/widget")({
  head: () => ({
    meta: [
      { title: "Lead capture widget — PropFlow CRM" },
      { name: "description", content: "Preview the embeddable PropFlow lead capture widget on a sample real estate website." },
    ],
  }),
  component: WidgetDemo,
});

function WidgetDemo() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Fake host site nav */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-white">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Acme Realty</span>
          </div>
          <nav className="hidden gap-6 text-sm text-zinc-600 md:flex">
            <a href="#">Listings</a><a href="#">Developers</a><a href="#">About</a><a href="#">Contact</a>
          </nav>
          <Button asChild size="sm" variant="outline"><Link to="/"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to CRM</Link></Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">New Capital · Q3 launch</p>
            <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight">Skyline Tower<br/>2BR City View</h1>
            <p className="mt-3 text-zinc-600">A sample property page on a real-estate website. The PropFlow widget below captures leads directly into your CRM in real time.</p>
            <div className="mt-5 flex gap-2">
              <Button>Book a viewing</Button>
              <Button variant="outline">Download brochure</Button>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              <Stat k="Bedrooms" v="2" />
              <Stat k="Bathrooms" v="2" />
              <Stat k="Area" v="110m²" />
            </div>
          </div>
          <img src="https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&q=80&auto=format&fit=crop"
            alt="Property" className="aspect-[4/3] w-full rounded-xl object-cover shadow-lg" />
        </div>

        <Card className="mt-12 p-6 shadow-card">
          <h2 className="text-base font-semibold">How the widget works</h2>
          <ol className="mt-2 list-decimal pl-5 text-sm text-zinc-600 space-y-1">
            <li>Drop one script tag on any webpage.</li>
            <li>The floating bubble appears in the bottom-right.</li>
            <li>Visitors submit name, phone, and interest — leads land instantly in PropFlow CRM.</li>
            <li>The assigned agent gets notified and can follow up immediately.</li>
          </ol>
          <pre className="mt-3 overflow-x-auto rounded-md bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">{`<script src="https://cdn.propflow.app/widget.js" data-tenant="acme-realty" defer></script>`}</pre>
        </Card>
      </section>

      <WidgetBubble />
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{k}</p>
      <p className="mt-1 text-lg font-semibold">{v}</p>
    </div>
  );
}

function WidgetBubble() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("I'm interested in the Skyline Tower listing.");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 rounded-xl border bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between rounded-t-xl bg-gradient-brand px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-semibold">Talk to an agent</span>
            </div>
            <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4">
            {submitted ? (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="mt-2 text-sm font-semibold">Thanks, {name || "there"}!</p>
                <p className="text-xs text-zinc-500">An agent will reach out shortly.</p>
                <p className="mt-3 text-[10px] text-zinc-400">Lead created in PropFlow CRM ✓</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-2">
                <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 h-9" /></div>
                <div><Label className="text-xs">Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} required className="mt-1 h-9" /></div>
                <div><Label className="text-xs">Message</Label>
                  <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} className="mt-1 w-full rounded-md border bg-transparent px-3 py-1.5 text-sm" />
                </div>
                <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground"><Send className="mr-1 h-3.5 w-3.5" /> Send</Button>
                <p className="text-center text-[10px] text-zinc-400">Powered by PropFlow</p>
              </form>
            )}
          </div>
        </div>
      )}
      <button
        onClick={() => { setOpen((o) => !o); setSubmitted(false); }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground shadow-xl hover:scale-105 transition"
        aria-label="Open chat widget"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </button>
    </>
  );
}