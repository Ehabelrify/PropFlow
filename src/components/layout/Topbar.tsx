import { Search, Bell, Plus, LogOut, User } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NewLeadDialog } from "@/components/crm/dialogs";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRole } from "@/lib/role-context";
import { ROLE_LABEL } from "@/lib/auth-context";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useTasks } from "@/hooks/use-supabase";

export function Topbar() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { scopedLeads } = useRole();
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      navigate({ to: "/leads", search: { q: q.trim() } });
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <SidebarTrigger className="text-muted-foreground" />
      <form onSubmit={onSubmit} className="relative hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search leads, properties, tasks…"
          className="h-9 border-transparent bg-muted/60 pl-9 focus-visible:bg-background focus-visible:ring-1"
        />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <NotificationsButton />
        <NewLeadButton />
        <ProfileDropdown />
      </div>
    </header>
  );
}

function ProfileDropdown() {
  const navigate = useNavigate();
  const { profile, roles, signOut } = useAuth();
  const { user, orgRole } = useRole();
  const initials = profile?.initials ?? user?.initials ?? "?";
  const avatarColor = profile?.avatar_color ?? user?.avatarColor ?? "bg-gray-500";
  const displayName = profile?.name ?? user?.name ?? "User";
  const displayEmail = profile?.email ?? user?.email ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 text-xs hover:bg-muted">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${avatarColor} text-[10px] font-semibold text-white`}>
            {initials}
          </div>
          <span className="hidden sm:flex flex-col items-start leading-tight">
            <span className="font-semibold truncate max-w-[120px]">{displayName.split(" ")[0]}</span>
            <span className="text-[10px] text-muted-foreground">{ROLE_LABEL[orgRole as keyof typeof ROLE_LABEL] ?? orgRole}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium">{displayName}</span>
            <span className="text-xs font-normal text-muted-foreground truncate">{displayEmail}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
          <User className="mr-2 h-4 w-4" />
          Profile & Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login" }); toast.success("Signed out"); }}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsButton() {
  const { scopedLeads } = useRole();
  const { data: tasks = [] } = useTasks();
  const overdueCount = (tasks as any[]).filter(t => t.status !== "done" && new Date(t.due_at) < new Date()).length;
  const hotCount = scopedLeads.filter(l => l.hot).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="relative h-9 w-9 p-0">
          <Bell className="h-4 w-4" />
          {overdueCount + hotCount > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-hot" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {overdueCount > 0 && (
          <DropdownMenuItem className="flex flex-col items-start">
            <span className="text-sm font-medium">{overdueCount} overdue task{overdueCount === 1 ? "" : "s"}</span>
            <span className="text-xs text-muted-foreground">Follow up before they go cold</span>
          </DropdownMenuItem>
        )}
        {hotCount > 0 && (
          <DropdownMenuItem className="flex flex-col items-start">
            <span className="text-sm font-medium">{hotCount} hot lead{hotCount === 1 ? "" : "s"}</span>
            <span className="text-xs text-muted-foreground">Reach out today</span>
          </DropdownMenuItem>
        )}
        {overdueCount === 0 && hotCount === 0 && (
          <DropdownMenuItem className="text-xs text-muted-foreground">All caught up</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => toast.success("All caught up")}>Mark all read</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewLeadButton() {
  const { has } = useRole();
  if (!has("leads.create")) return null;
  return (
    <NewLeadDialog
      trigger={
        <Button size="sm" className="h-9 gap-1.5 bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-95">
          <Plus className="h-4 w-4" /> New Lead
        </Button>
      }
    />
  );
}
