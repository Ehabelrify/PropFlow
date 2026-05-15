import type { PipelineStageDef } from "./types";

export const PIPELINE_STAGES: PipelineStageDef[] = [
  { id: "new", label: "New", tone: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" },
  { id: "contacted", label: "Contacted", tone: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800" },
  { id: "qualified", label: "Qualified", tone: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800" },
  { id: "viewing", label: "Viewing", tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  { id: "negotiation", label: "Negotiation", tone: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800" },
  { id: "won", label: "Won", tone: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" },
  { id: "lost", label: "Lost", tone: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
];

export function formatCurrency(n: number) {
  if (n >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `EGP ${(n / 1_000).toFixed(0)}K`;
  return `EGP ${n}`;
}

export function getStage(id: string) {
  return PIPELINE_STAGES.find(s => s.id === id);
}
