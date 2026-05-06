import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Inbox, KanbanSquare, CheckSquare, Calendar, Building2, BarChart3, Users, Settings, Shield, ClipboardList, UserCircle,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useRole, ORG_ROLE_LABEL } from "@/lib/role-context";
import type { Permission } from "@/lib/role-context";

type NavItem = { title: string; url: string; icon: any; exact?: boolean; perm?: Permission };

const main: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Leads", url: "/leads", icon: Inbox },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Appointments", url: "/appointments", icon: Calendar },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Analytics", url: "/analytics", icon: BarChart3, perm: "analytics.view_team" },
];

const account: NavItem[] = [
  { title: "Profile", url: "/settings", icon: UserCircle },
  { title: "Team", url: "/team", icon: Users },
];

const team: NavItem[] = [
  { title: "Approvals", url: "/approvals", icon: ClipboardList, perm: "tenant.manage_team" },
  { title: "Settings", url: "/settings", icon: Settings, perm: "tenant.configure" },
];

const platform: NavItem[] = [
  { title: "Platform Admin", url: "/admin", icon: Shield, perm: "platform.view" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, orgRole, has } = useRole();
  const isActive = (url: string, exact?: boolean) =>
    exact ? path === url : path === url || path.startsWith(url + "/");
  const visible = (items: NavItem[]) => items.filter(i => !i.perm || has(i.perm));
 
  const mainItems = visible(main);
  const accountItems = visible(account);
  const teamItems = visible(team);
  const platformItems = visible(platform);

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
              {mainItems.map((item) => (
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
        {accountItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Account</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {accountItems.map((item) => (
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
        )}
        {teamItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Organization</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {teamItems.map((item) => (
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
        )}
        {platformItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {platformItems.map((item) => (
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
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${user?.avatarColor ?? "bg-gray-500"} text-[11px] font-semibold text-white`}>
            {user?.initials ?? "?"}
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{user?.name ?? "User"}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {ORG_ROLE_LABEL[orgRole]}
              </span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
