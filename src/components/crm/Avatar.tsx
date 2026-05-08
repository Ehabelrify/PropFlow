type AvatarUser = {
  id?: string;
  name?: string | null;
  initials?: string | null;
  avatar_color?: string | null;
};

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
  const fallbackInitial = userId?.slice(0, 1).toUpperCase() ?? "?";
  
  if (!user) {
    return (
      <div className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gray-300 ${dim} font-semibold text-white ring-2 ring-background`}>
        {fallbackInitial}
      </div>
    );
  }
  
  return (
    <div
      title={user.name || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${user.avatar_color} ${dim} font-semibold text-white ring-2 ring-background`}
    >
      {user.initials}
    </div>
  );
}
