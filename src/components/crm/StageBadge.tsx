import { getStage } from "@/lib/constants";
import type { LeadStage } from "@/lib/types";

export function StageBadge({ stage }: { stage: LeadStage }) {
  const s = getStage(stage);
  if (!s) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${s.tone}`}>
      {s.label}
    </span>
  );
}
