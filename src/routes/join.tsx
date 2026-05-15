import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Building2, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRedeemInvitation } from "@/hooks/use-supabase";
import { toast } from "sonner";
import { sanitizeText } from "@/lib/sanitize";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [{ title: "Join workspace — PropFlow CRM" }],
  }),
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const { isAuthed, loading, profile, refresh, user } = useAuth();
  const redeem = useRedeemInvitation();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && isAuthed && profile?.tenant_status !== "pending_approval" && profile?.tenant_status !== "rejected") {
      if (profile?.tenant_id) navigate({ to: "/" });
    }
  }, [isAuthed, loading, profile, navigate]);

  const handleSubmit = async () => {
    try {
      // Validate and sanitize invitation code
      const sanitizedCode = sanitizeText(code, 10).trim().toUpperCase();
      
      if (!sanitizedCode || sanitizedCode.length < 3) {
        toast.error("Enter a valid invitation code");
        return;
      }
      
      if (!user?.id) {
        toast.error("Sign in required");
        return;
      }
      
      // Validate code format (alphanumeric only)
      if (!/^[A-Z0-9]+$/.test(sanitizedCode)) {
        toast.error("Invalid invitation code format");
        return;
      }
      
      setBusy(true);
      
      redeem.mutate({ code: sanitizedCode, userId: user.id }, {
        onSuccess: async () => {
          toast.success("Joined workspace!");
          setSuccess(true);
          await refresh();
        },
        onError: (e) => toast.error(e.message),
        onSettled: () => setBusy(false),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid input");
      setBusy(false);
    }
  };

  // If already in a workspace, redirect
  if (!loading && isAuthed && profile?.tenant_id && profile.tenant_status === "active") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/40 px-4">
        <Card className="max-w-md p-8 text-center shadow-card">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h2 className="mt-3 text-xl font-semibold">Already in a workspace</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You're already a member of a workspace. Contact your manager if you need to switch teams.
          </p>
          <Link to="/">
            <Button className="mt-5 bg-gradient-brand text-primary-foreground">Go to dashboard</Button>
          </Link>
        </Card>
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
            <p className="text-xs text-muted-foreground">Join your workspace</p>
          </div>
        </div>

        <Card className="p-6 shadow-card">
          {success ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h2 className="mt-3 text-xl font-semibold">Welcome aboard!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You've joined your workspace. Your manager will assign you to a team.
              </p>
              <Link to="/">
                <Button className="mt-5 bg-gradient-brand text-primary-foreground">Go to dashboard</Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold">Join your workspace</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the invitation code shared by your manager.
              </p>
              <div className="mt-5 space-y-3">
                <div>
                  <Label className="text-xs">Invitation code</Label>
                  <Input
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    className="mt-1 font-mono text-center text-lg tracking-widest"
                    maxLength={6}
                  />
                </div>
                <Button onClick={handleSubmit} disabled={busy || code.length < 3} className="w-full bg-gradient-brand text-primary-foreground">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="mr-1.5 h-4 w-4" /> Join workspace</>}
                </Button>
                {!isAuthed && (
                  <p className="text-center text-xs text-muted-foreground">
                    Need an account? <Link to="/signup" className="text-primary hover:underline">Sign up first</Link>
                  </p>
                )}
              </div>
            </>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
