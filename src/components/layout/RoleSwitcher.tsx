import { ChevronDown, ShieldCheck } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { USERS, getTeam } from "@/lib/mock-data";
import { useRole, ORG_ROLE_LABEL, ORG_ROLE_DESC } from "@/lib/role-context";
import { orgRoleOf } from "@/lib/mock-data";

export function RoleSwitcher() {
  const { user, orgRole, setUserId } = useRole();
  const team = getTeam(user.teamId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 text-xs hover:bg-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:flex flex-col items-start leading-tight">
            <span className="font-semibold">{ORG_ROLE_LABEL[orgRole]}</span>
            <span className="text-[10px] text-muted-foreground">{user.name.split(" ")[0]}{team ? ` · ${team.name}` : ""}</span>
          </span>
          <span className="sm:hidden font-semibold">{ORG_ROLE_LABEL[orgRole]}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Demo · view as
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {USERS.map(u => {
          const role = orgRoleOf(u);
          const t = getTeam(u.teamId);
          const active = u.id === user.id;
          return (
            <DropdownMenuItem key={u.id} onClick={() => setUserId(u.id)} className="flex items-start gap-2 py-2">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${u.avatarColor} text-[10px] font-semibold text-white`}>
                {u.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{u.name}</span>
                  {active && <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">Active</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {ORG_ROLE_LABEL[role]}{t ? ` · ${t.name}` : ""}
                </div>
                <div className="text-[10px] text-muted-foreground/80 italic">{ORG_ROLE_DESC[role]}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}