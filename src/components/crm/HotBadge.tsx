import { Flame } from "lucide-react";
export function HotBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-hot/10 px-1.5 py-0.5 text-[10px] font-semibold text-hot">
      <Flame className="h-2.5 w-2.5" /> HOT
    </span>
  );
}
