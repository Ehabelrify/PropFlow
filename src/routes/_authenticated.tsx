import { createFileRoute, Outlet, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Clock, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    const auth = context.auth;
    
    if (auth?.loading) return;
    
    const profile = auth?.profile;
    
    if (!profile) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    
    // Check tenant status
    if (profile.tenant_status === "suspended") {
      throw redirect({ to: "/suspended" });
    }
    
    if (profile.tenant_status === "pending_approval" || profile.tenant_status === "rejected") {
      // Allow through - will be handled by component
    }
    
    // Pass both profile and auth to child routes
    return { profile, auth };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { isAuthed, loading, tenantPending, profile, refresh } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const search = useRouterState({ select: (r) => r.location.search });

  useEffect(() => {
    if (!loading && !isAuthed) {
      const redirect = path + (Object.keys(search as unknown as Record<string, unknown>).length
        ? `?${new URLSearchParams(search as any).toString()}`
        : "");
      navigate({ to: "/login", search: { redirect } });
    }
  }, [isAuthed, loading, navigate, path, search]);

  // Check if tenant was just approved (polling)
  useEffect(() => {
    if (!tenantPending || !profile?.tenant_id) return;
    const tenantId = profile.tenant_id;
    const interval = setInterval(async () => {
      const { data } = await db.from("tenants").select("status").eq("id", tenantId).maybeSingle();
      if (data?.status === "active") {
        await refresh(); // Refresh auth/profile state
        navigate({ to: "/" }); // Navigate in-app to dashboard without reload
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [tenantPending, profile?.tenant_id, refresh, navigate]);

  if (loading || !isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tenantPending || profile?.tenant_status === "suspended") {
    const isRejected = profile?.tenant_status === "rejected";
    const isSuspended = profile?.tenant_status === "suspended";
    
    if (isSuspended) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/40 px-4">
          <Card className="max-w-md p-8 text-center shadow-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Account Suspended</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your workspace has been suspended. Please contact support for assistance.
            </p>
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => supabase.auth.signOut()}
            >
              Sign Out
            </Button>
          </Card>
        </div>
      );
    }
    
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/40 px-4">
        <Card className="max-w-md p-8 text-center shadow-card">
          {isRejected ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <Clock className="h-7 w-7 text-destructive" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">Workspace not approved</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your workspace request was not approved. Please contact the platform administrator for more information.
              </p>
              <Button className="mt-5 bg-gradient-brand text-primary-foreground" onClick={() => navigate({ to: "/login" })}>
                Back to sign in
              </Button>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/15">
                <Clock className="h-7 w-7 text-warning" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">Workspace pending approval</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your workspace <strong>{profile?.name}</strong> is awaiting approval from a platform administrator.
                You'll get full access once approved.
              </p>
              <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>Checking automatically every 10 seconds...</p>
              </div>
              <div className="mt-4 flex gap-2 justify-center">
                <Button variant="outline" onClick={refresh}>Check now</Button>
                <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
