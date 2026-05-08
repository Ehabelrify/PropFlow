import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2, Loader2, CheckCircle2, ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRedeemInvitation } from "@/hooks/use-supabase";
import { toast } from "sonner";

const db = supabase as any;

const PLANS = [
  { id: "starter", name: "Starter", seats: 5, price: "$0", desc: "Up to 5 agents, basic CRM" },
  { id: "professional", name: "Professional", seats: 25, price: "$49/mo", desc: "Up to 25 agents, advanced features" },
  { id: "enterprise", name: "Enterprise", seats: 100, price: "Custom", desc: "Unlimited agents, priority support" },
];

const searchSchema = z.object({ mode: z.string().optional() });

export const Route = createFileRoute("/signup")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign up — PropFlow CRM" },
      { name: "description", content: "Create your PropFlow CRM workspace or join an existing team." },
    ],
  }),
  component: SignupPage,
});

type Mode = "manager" | "agent";
type Step = "mode" | "company" | "personal" | "plan" | "agent-code" | "success";

function SignupPage() {
  const navigate = useNavigate();
  const { mode: urlMode } = useSearch({ from: "/signup" });
  const { isAuthed, loading } = useAuth();
  const [mode, setMode] = useState<Mode>(urlMode === "agent" ? "agent" : "manager");
  const [step, setStep] = useState<Step>(urlMode === "agent" ? "agent-code" : "mode");
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("starter");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  const redeem = useRedeemInvitation();

  useEffect(() => {
    if (!loading && isAuthed) navigate({ to: "/" });
  }, [isAuthed, loading, navigate]);

  useEffect(() => {
    setSlug(companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40));
  }, [companyName]);

  const submitManager = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!email.trim()) return toast.error("Email is required");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (!companyName.trim()) return toast.error("Company name is required");

    setBusy(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (authError) {
      setBusy(false);
      return toast.error(authError.message);
    }

    if (!authData.user) {
      setBusy(false);
      return toast.error("Signup failed — please try again");
    }

    const { error: rpcError } = await db.rpc("complete_manager_signup", {
      _user_id: authData.user.id,
      _tenant_name: companyName.trim(),
      _tenant_slug: slug || companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
      _plan: plan,
      _seats: PLANS.find(p => p.id === plan)?.seats ?? 5,
    });

    setBusy(false);

    if (rpcError) {
      return toast.error(rpcError.message);
    }

    toast.success("Workspace created! Awaiting super admin approval.");
    setStep("success");
  };

  const submitAgent = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!email.trim()) return toast.error("Email is required");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (inviteCode.length < 3) return toast.error("Enter a valid invite code");

    setBusy(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (authError) {
      setBusy(false);
      return toast.error(authError.message);
    }

    if (!authData.user) {
      setBusy(false);
      return toast.error("Signup failed — please try again");
    }

    redeem.mutate({
      code: inviteCode.trim().toUpperCase(),
      userId: authData.user.id
    }, {
      onSuccess: () => {
        toast.success("Account created and joined workspace!");
        setStep("success");
        setBusy(false);
      },
      onError: (e) => {
        toast.error(e.message);
        setBusy(false);
      },
    });
  };

  if (loading || isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-semibold tracking-tight">PropFlow CRM</h1>
            <p className="text-xs text-muted-foreground">Real estate sales platform</p>
          </div>
        </div>

        <Card className="p-6 shadow-card">
          {step === "mode" && (
            <>
              <h2 className="text-xl font-semibold">Get started</h2>
              <p className="mt-1 text-sm text-muted-foreground">Create a workspace or join an existing team.</p>
              <div className="mt-5 space-y-3">
                <button
                  onClick={() => { setMode("manager"); setStep("company"); }}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    mode === "manager" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-semibold">Create a workspace</p>
                  <p className="text-xs text-muted-foreground">You're a manager setting up a new organization</p>
                </button>
                <button
                  onClick={() => { setMode("agent"); setStep("agent-code"); }}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    mode === "agent" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-semibold">Join with invite code</p>
                  <p className="text-xs text-muted-foreground">You're an agent joining an existing team</p>
                </button>
              </div>
            </>
          )}

          {step === "company" && (
            <CompanyStep
              companyName={companyName}
              setCompanyName={setCompanyName}
              slug={slug}
              onBack={() => setStep("mode")}
              onNext={() => setStep("personal")}
            />
          )}

          {step === "personal" && (
            <PersonalStep
              name={name} setName={setName}
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              onBack={() => setStep("company")}
              onNext={() => setStep("plan")}
            />
          )}

          {step === "plan" && (
            <PlanStep
              plan={plan}
              setPlan={setPlan}
              onBack={() => setStep("personal")}
              onSubmit={submitManager}
              busy={busy}
            />
          )}

          {step === "agent-code" && (
            <AgentStep
              name={name} setName={setName}
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              inviteCode={inviteCode} setInviteCode={setInviteCode}
              onBack={() => setStep("mode")}
              onSubmit={submitAgent}
              busy={busy}
            />
          )}

          {step === "success" && <SuccessStep mode={mode} />}
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function CompanyStep({ companyName, setCompanyName, slug, onBack, onNext }: {
  companyName: string; setCompanyName: (v: string) => void; slug: string; onBack: () => void; onNext: () => void;
}) {
  return (
    <>
      <h2 className="text-xl font-semibold">Create your workspace</h2>
      <p className="mt-1 text-sm text-muted-foreground">Tell us about your company.</p>
      <div className="mt-5 space-y-3">
        <div>
          <Label className="text-xs">Company name</Label>
          <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Realty" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Workspace URL</Label>
          <div className="mt-1 flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1.5 text-sm">
            <span className="text-muted-foreground">propflow.app/</span>
            <span className="font-medium">{slug || "your-company"}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          <Button type="button" disabled={!companyName.trim()} onClick={onNext} className="flex-1 bg-gradient-brand text-primary-foreground">
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

function PersonalStep({ name, setName, email, setEmail, password, setPassword, onBack, onNext }: {
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <>
      <h2 className="text-xl font-semibold">Your details</h2>
      <p className="mt-1 text-sm text-muted-foreground">Create your manager account.</p>
      <div className="mt-5 space-y-3">
        <div>
          <Label className="text-xs">Full name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@acme.com" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Password</Label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          <Button type="button" disabled={!name.trim() || !email.trim() || password.length < 8} onClick={onNext} className="flex-1 bg-gradient-brand text-primary-foreground">
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

function PlanStep({ plan, setPlan, onBack, onSubmit, busy }: {
  plan: string; setPlan: (v: string) => void;
  onBack: () => void; onSubmit: () => void; busy: boolean;
}) {
  return (
    <>
      <h2 className="text-xl font-semibold">Choose your plan</h2>
      <p className="mt-1 text-sm text-muted-foreground">Start free, upgrade anytime.</p>
      <div className="mt-5 space-y-3">
        {PLANS.map(p => (
          <button
            key={p.id}
            onClick={() => setPlan(p.id)}
            className={`w-full rounded-lg border p-4 text-left transition ${
              plan === p.id
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{p.price}</p>
                <p className="text-[10px] text-muted-foreground">{p.seats} seats</p>
              </div>
            </div>
          </button>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          <Button onClick={onSubmit} disabled={busy} className="flex-1 bg-gradient-brand text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create workspace"}
          </Button>
        </div>
      </div>
    </>
  );
}

function AgentStep({ name, setName, email, setEmail, password, setPassword, inviteCode, setInviteCode, onBack, onSubmit, busy }: {
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  inviteCode: string; setInviteCode: (v: string) => void;
  onBack: () => void; onSubmit: () => void; busy: boolean;
}) {
  return (
    <>
      <h2 className="text-xl font-semibold">Join your team</h2>
      <p className="mt-1 text-sm text-muted-foreground">Create your account with an invite code.</p>
      <div className="mt-5 space-y-3">
        <div>
          <Label className="text-xs">Invitation code</Label>
          <Input
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="mt-1 font-mono text-center text-lg tracking-widest"
            maxLength={6}
          />
        </div>
        <div>
          <Label className="text-xs">Full name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@acme.com" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Password</Label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          <Button onClick={onSubmit} disabled={busy || !inviteCode.trim() || !name.trim() || !email.trim() || password.length < 8} className="flex-1 bg-gradient-brand text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="mr-1.5 h-4 w-4" /> Join workspace</>}
          </Button>
        </div>
      </div>
    </>
  );
}

function SuccessStep({ mode }: { mode: Mode }) {
  return (
    <div className="py-4 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
      <h2 className="mt-3 text-xl font-semibold">
        {mode === "manager" ? "Workspace created!" : "Joined workspace!"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "manager"
          ? "Your workspace is pending approval from a platform administrator. You'll get access once approved."
          : "You've joined your team. Your manager will assign you to a team and leads."}
      </p>
      <div className="mt-5 flex gap-2 justify-center">
        <Link to="/login">
          <Button variant="outline">Back to sign in</Button>
        </Link>
      </div>
    </div>
  );
}
