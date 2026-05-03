import { Search, Bell, Plus } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RoleSwitcher } from "./RoleSwitcher";
import { useRole } from "@/lib/role-context";
import { NewLeadDialog } from "@/components/crm/dialogs";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/data-store";
import { toast } from "sonner";

export function Topbar() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/leads" });
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
        <RoleSwitcher />
        <NotificationsButton />
        <NewLeadButton />
      </div>
    </header>
  );
}

function NotificationsButton() {
  const { tasks, leads } = useStore();
  const overdueCount = tasks.filter(t => t.status !== "done" && new Date(t.dueAt) < new Date()).length;
  const hotCount = leads.filter(l => l.hot).length;
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
        <DropdownMenuItem className="flex flex-col items-start">
          <span className="text-sm font-medium">{overdueCount} overdue task{overdueCount === 1 ? "" : "s"}</span>
          <span className="text-xs text-muted-foreground">Follow up before they go cold</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex flex-col items-start">
          <span className="text-sm font-medium">{hotCount} hot lead{hotCount === 1 ? "" : "s"}</span>
          <span className="text-xs text-muted-foreground">Reach out today</span>
        </DropdownMenuItem>
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
