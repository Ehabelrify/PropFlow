import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Guard runs server-side too; redirect handled in component
    return {};
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { isAuthed, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const search = useRouterState({ select: (r) => r.location.search });

  useEffect(() => {
    if (!loading && !isAuthed) {
      const redirect = path + (Object.keys(search as Record<string, unknown>).length
        ? `?${new URLSearchParams(search as any).toString()}`
        : "");
      navigate({ to: "/login", search: { redirect } });
    }
  }, [isAuthed, loading, navigate, path, search]);

  if (loading || !isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
