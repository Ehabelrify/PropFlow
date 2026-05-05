import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — PropFlow CRM" },
      { name: "description", content: "Sign in to your PropFlow CRM account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const { isAuthed, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthed) navigate({ to: (redirect as any) || "/" });
  }, [isAuthed, loading, redirect, navigate]);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: (redirect as any) || "/" });
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — you can now sign in");
    setMode("signin");
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Reset link sent — check your inbox");
    setMode("signin");
  };

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
          <h2 className="text-xl font-semibold">
            {mode === "signin" && "Sign in"}
            {mode === "signup" && "Create account"}
            {mode === "forgot" && "Reset password"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" && "Welcome back. Enter your credentials."}
            {mode === "signup" && "Get started in seconds."}
            {mode === "forgot" && "We'll email you a reset link."}
          </p>

          {mode === "signin" && (
            <form onSubmit={onSignIn} className="mt-5 space-y-3">
              <Field label="Email" type="email" value={email} onChange={setEmail} />
              <Field label="Password" type="password" value={password} onChange={setPassword} />
              <Button type="submit" disabled={busy} className="w-full bg-gradient-brand text-primary-foreground">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
              <div className="flex justify-between text-xs">
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
                <button type="button" className="text-primary hover:underline" onClick={() => setMode("signup")}>
                  Create account
                </button>
              </div>
            </form>
          )}

          {mode === "signup" && (
            <div className="mt-5 space-y-3">
              <p className="text-sm">
                Creating a workspace? <Link to="/signup" className="text-primary hover:underline">Sign up as a manager</Link>
              </p>
              <p className="text-xs text-muted-foreground">
                Managers can create workspaces and invite team members.
                If you're joining an existing team, ask your manager for an invite link.
              </p>
              <button type="button" className="block w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            </div>
          )}

          {mode === "forgot" && (
            <form onSubmit={onForgot} className="mt-5 space-y-3">
              <Field label="Email" type="email" value={email} onChange={setEmail} />
              <Button type="submit" disabled={busy} className="w-full bg-gradient-brand text-primary-foreground">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
              </Button>
              <button type="button" className="block w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            </form>
          )}
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Want to explore without signing in?{" "}
          <Link to="/demo" className="text-primary hover:underline">Try the demo</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", hint }: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required className="mt-1" />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}