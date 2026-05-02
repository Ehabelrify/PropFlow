import { getUser } from "@/lib/mock-data";

export function UserAvatar({ userId, size = "sm" }: { userId: string; size?: "xs" | "sm" | "md" }) {
  const user = getUser(userId);
  const dim = size === "xs" ? "h-5 w-5 text-[9px]" : size === "md" ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";
  if (!user) return null;
  return (
    <div title={user.name} className={`inline-flex shrink-0 items-center justify-center rounded-full ${user.avatarColor} ${dim} font-semibold text-white ring-2 ring-background`}>
      {user.initials}
    </div>
  );
}
