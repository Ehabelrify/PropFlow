import { Outlet, Link, createRootRoute, ScrollRestoration } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { RoleProvider } from "@/lib/role-context";
import { AuthProvider } from "@/lib/auth-context";
import appCss from "../styles.css?url";
import { Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Create QueryClient as a module-level constant to prevent infinite re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>PropFlow</title>
        <link rel="stylesheet" href={appCss} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PropFlow CRM — Real Estate Sales Platform" },
      { name: "description", content: "Multi-tenant CRM for real estate brokers, developers, and resellers. Capture leads, manage pipelines, schedule visits, and close deals faster." },
      { property: "og:title", content: "PropFlow CRM" },
      { property: "og:description", content: "Real estate CRM for brokers, developers and resellers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoleProvider>
          <Outlet />
          <Toaster />
        </RoleProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
