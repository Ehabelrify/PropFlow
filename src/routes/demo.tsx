import { createFileRoute, Link } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo — PropFlow CRM" },
      { name: "description", content: "Try every role of PropFlow CRM without an account." },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 min-w-0 p-6 space-y-4">
            <Card className="p-5 shadow-card">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-lg font-semibold">Demo mode</h1>
                  <p className="text-sm text-muted-foreground">
                    Switch between mock users to preview each role's experience. No sign-in required.
                  </p>
                </div>
                <RoleSwitcher />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><Link to="/">Dashboard</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/leads">Leads</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/pipeline">Pipeline</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/properties">Properties</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/team">Team</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/admin">Platform Admin</Link></Button>
              </div>
            </Card>
            <Card className="p-5 shadow-card">
              <h2 className="text-sm font-semibold">Ready for the real thing?</h2>
              <p className="mt-1 text-xs text-muted-foreground">Create a real account to start working with live data.</p>
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm" className="bg-gradient-brand text-primary-foreground"><Link to="/login">Sign in / Sign up</Link></Button>
                <Button asChild size="sm" variant="ghost"><Link to="/login"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to login</Link></Button>
              </div>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}