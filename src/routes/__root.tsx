import { Outlet, Link, createRootRouteWithContext } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { RoleProvider } from "@/lib/role-context";
import { AuthProvider, useAuth, type AuthCtx } from "@/lib/auth-context";

// Create QueryClient as a module-level constant to prevent infinite re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export const Route = createRootRouteWithContext<{
  auth: AuthCtx | undefined;
}>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  head: () => ({
    meta: [
      { title: "PropFlow CRM — Real Estate Sales Platform" },
      { name: "description", content: "Multi-tenant CRM for real estate brokers, developers, and resellers. Capture leads, manage pipelines, schedule visits, and close deals faster." },
      { property: "og:title", content: "PropFlow CRM" },
      { property: "og:description", content: "Real estate CRM for brokers, developers and resellers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoleProvider>
          <InnerRoot />
        </RoleProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function InnerRoot() {
  const auth = useAuth();
  const router = Route.useRouter();
  
  // Update router context with auth state
  router.options.context = { auth };
  
  return (
    <>
      <Outlet />
      <Toaster />
    </>
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
