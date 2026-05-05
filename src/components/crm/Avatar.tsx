import { useProfiles } from "@/hooks/use-supabase";

export function UserAvatar({ userId, size = "sm" }: { userId: string; size?: "xs" | "sm" | "md" }) {
  const { data: profiles = [] } = useProfiles();
  const user = profiles.find((p: any) => p.id === userId);
  const dim = size === "xs" ? "h-5 w-5 text-[9px]" : size === "md" ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";
  if (!user) return <div className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gray-300 ${dim} font-semibold text-white ring-2 ring-background`}>?</div>;
  return (
    <div title={user.name} className={`inline-flex shrink-0 items-center justify-center rounded-full ${user.avatar_color} ${dim} font-semibold text-white ring-2 ring-background`}>
      {user.initials}
    </div>
  );
}
