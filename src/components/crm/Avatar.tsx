type AvatarUser = {
  id?: string;
  name?: string | null;
  initials?: string | null;
  avatar_color?: string | null;
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  user,
  userId,
  size = "sm",
}: {
  user?: AvatarUser | null;
  userId?: string | null;
  size?: "xs" | "sm" | "md";
}) {
  const dim = size === "xs" ? "h-5 w-5 text-[9px]" : size === "md" ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";
  
  if (!user) {
    const initial = userId?.slice(0, 1).toUpperCase() ?? "?";
    return (
      <div className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gray-300 ${dim} font-semibold text-white ring-2 ring-background`}
        aria-label="Unknown user"
      >
        {initial}
      </div>
    );
  }
  
  const initials = user.initials || getInitials(user.name);
  
  return (
    <div
      title={user.name || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${user.avatar_color ?? "bg-gray-400"} ${dim} font-semibold text-white ring-2 ring-background`}
      aria-label={user.name ? `Avatar for ${user.name}` : "User avatar"}
    >
      {initials}
    </div>
  );
}
