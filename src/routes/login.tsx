import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Building2, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize";

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
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [rateLimitMessage, setRateLimitMessage] = useState("");
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && isAuthed) {
      navigate({ to: (redirect as any) || "/" });
    }
  }, [isAuthed, loading, redirect, navigate]);

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    
    try {
      // Sanitize inputs
      const sanitizedEmail = sanitizeEmail(email);
      const sanitizedPassword = sanitizeText(password, 100);
      
      const { error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: sanitizedPassword
      });
      
      if (error) {
        toast.error(error.message);
        return;
      }
      
      toast.success("Welcome back");
      // Don't navigate here - let the useEffect handle it to avoid double navigation
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid input");
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    
    try {
      // Sanitize inputs
      const sanitizedEmail = sanitizeEmail(email);
      const sanitizedPassword = sanitizeText(password, 100);
      const sanitizedName = sanitizeText(name, 100);
      
      const { error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password: sanitizedPassword,
        options: {
          data: { name: sanitizedName },
          emailRedirectTo: `${window.location.origin}/`
        },
      });
      
      if (error) {
        toast.error(error.message);
        return;
      }
      
      toast.success("Account created — you can now sign in");
      setMode("signin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid input");
    } finally {
      setBusy(false);
    }
  };

  const startCooldown = (seconds: number) => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    setCooldownSeconds(seconds);

    cooldownIntervalRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          setRateLimitMessage("");
          return 0;
        }

        return prev - 1;
      });
    }, 1000);
  };

  const formatCooldownTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    return `${remainingSeconds}s`;
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setBusy(true);
    setRateLimitMessage("");

    try {
      // Sanitize email input
      const normalizedEmail = sanitizeEmail(email);

      const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc("check_password_reset_rate_limit", {
        p_email: normalizedEmail,
        p_ip_address: null,
      });

      if (rateLimitError) {
        // Rate limit check failed, but continue with the request
      }

      if (rateLimitCheck && !rateLimitCheck.allowed) {
        const message =
          typeof rateLimitCheck.message === "string"
            ? rateLimitCheck.message
            : "Too many password reset attempts. Please try again later.";

        setRateLimitMessage(message);

        if (typeof rateLimitCheck.retry_after === "number" && rateLimitCheck.retry_after > 0) {
          startCooldown(rateLimitCheck.retry_after);
        }

        toast.error(message);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      await supabase.rpc("log_password_reset_attempt", {
        p_email: normalizedEmail,
        p_ip_address: null,
        p_success: !error,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Reset link sent — check your inbox");
      setMode("signin");
    } finally {
      setBusy(false);
    }
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
              <h3 className="text-sm font-semibold">Get started</h3>
              <p className="text-xs text-muted-foreground">Create a workspace or join an existing team.</p>
              <div className="space-y-2">
                <button
                  onClick={() => navigate({ to: "/signup" })}
                  className="w-full rounded-lg border border-border p-3 text-left transition hover:border-primary/50"
                >
                  <p className="text-sm font-semibold">Create a Workspace</p>
                  <p className="text-xs text-muted-foreground">You're a manager setting up a new organization</p>
                </button>
                <button
                  onClick={() => navigate({ to: "/signup", search: { mode: "agent" } })}
                  className="w-full rounded-lg border border-border p-3 text-left transition hover:border-primary/50"
                >
                  <p className="text-sm font-semibold">Join a Workspace</p>
                  <p className="text-xs text-muted-foreground">You're an agent joining with an invite code</p>
                </button>
              </div>
              <button type="button" className="block w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            </div>
          )}

          {mode === "forgot" && (
            <form onSubmit={onForgot} className="mt-5 space-y-3">
              {rateLimitMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between gap-3">
                    <span>{rateLimitMessage}</span>
                    {cooldownSeconds > 0 && (
                      <span className="flex items-center gap-1 whitespace-nowrap font-mono text-xs">
                        <Clock className="h-3 w-3" />
                        {formatCooldownTime(cooldownSeconds)}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <Field label="Email" type="email" value={email} onChange={setEmail} disabled={busy || cooldownSeconds > 0} />
              <Button type="submit" disabled={busy || cooldownSeconds > 0} className="w-full bg-gradient-brand text-primary-foreground">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : cooldownSeconds > 0 ? `Wait ${formatCooldownTime(cooldownSeconds)}` : "Send reset link"}
              </Button>
              <button type="button" className="block w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required disabled={disabled} className="mt-1" />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}