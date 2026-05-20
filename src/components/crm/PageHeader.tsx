import type { ReactNode } from "react";

export function PageHeader({
  title, description, actions,
}: { title: ReactNode; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b bg-gradient-subtle px-6 py-5 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="min-w-0 flex-1 space-y-1.5">
        {typeof title === "string" ? (
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        ) : (
          <div className="text-xl font-semibold tracking-tight md:text-2xl">{title}</div>
        )}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2 md:pt-0.5">{actions}</div>}
    </div>
  );
}
