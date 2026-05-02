import { useEffect, useState, type ReactNode } from "react";

export function ClientChart({ children, height = 256 }: { children: ReactNode; height?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return (
    <div style={{ width: "100%", height }}>
      {mounted ? children : <div className="h-full w-full animate-pulse rounded-md bg-muted/40" />}
    </div>
  );
}
