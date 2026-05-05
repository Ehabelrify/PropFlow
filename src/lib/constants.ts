import type { PipelineStageDef } from "./types";

export const PIPELINE_STAGES: PipelineStageDef[] = [
  { id: "new", label: "New", tone: "bg-info/10 text-info border-info/20" },
  { id: "contacted", label: "Contacted", tone: "bg-accent text-accent-foreground border-border" },
  { id: "qualified", label: "Qualified", tone: "bg-primary-soft text-primary border-primary/20" },
  { id: "viewing", label: "Viewing", tone: "bg-warning/15 text-warning-foreground border-warning/30" },
  { id: "negotiation", label: "Negotiation", tone: "bg-chart-5/15 text-chart-5 border-chart-5/30" },
  { id: "won", label: "Won", tone: "bg-success/15 text-success border-success/30" },
  { id: "lost", label: "Lost", tone: "bg-destructive/10 text-destructive border-destructive/20" },
];

export function formatCurrency(n: number) {
  if (n >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `EGP ${(n / 1_000).toFixed(0)}K`;
  return `EGP ${n}`;
}

export function getStage(id: string) {
  return PIPELINE_STAGES.find(s => s.id === id);
}
