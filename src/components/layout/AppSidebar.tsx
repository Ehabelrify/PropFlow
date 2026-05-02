import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Inbox, KanbanSquare, CheckSquare, Calendar, Building2, BarChart3, Users, Settings,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { CURRENT_USER } from "@/lib/mock-data";

const main = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Leads", url: "/leads", icon: Inbox },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Appointments", url: "/appointments", icon: Calendar },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const team = [
  { title: "Team", url: "/team", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? path === url : path === url || path.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-sm">
            <Building2 className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">PropFlow</span>
              <span className="text-[11px] text-muted-foreground">Real Estate CRM</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Organization</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {team.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${CURRENT_USER.avatarColor} text-[11px] font-semibold text-white`}>
            {CURRENT_USER.initials}
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{CURRENT_USER.name}</span>
              <span className="truncate text-[11px] capitalize text-muted-foreground">{CURRENT_USER.role}</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
