import { Search, Bell, Plus } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <SidebarTrigger className="text-muted-foreground" />
      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search leads, properties, tasks…"
          className="h-9 border-transparent bg-muted/60 pl-9 focus-visible:bg-background focus-visible:ring-1"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="ghost" className="relative h-9 w-9 p-0">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-hot" />
        </Button>
        <Button size="sm" className="h-9 gap-1.5 bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-95">
          <Plus className="h-4 w-4" /> New Lead
        </Button>
      </div>
    </header>
  );
}
