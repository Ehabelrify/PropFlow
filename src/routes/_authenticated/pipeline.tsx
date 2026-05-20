import { createFileRoute } from "@tanstack/react-router";
import type { DragEvent } from "react";
import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/crm/PageHeader";
import { useRole } from "@/lib/role-context";
import { useUpdateLead } from "@/hooks/use-supabase";
import { PIPELINE_STAGES, formatCurrency } from "@/lib/constants";
import { StageBadge } from "@/components/crm/StageBadge";
import { HotBadge } from "@/components/crm/HotBadge";
import { UserAvatar } from "@/components/crm/Avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — PropFlow CRM" }] }),
  component: PipelinePage,
});

function PipelinePage() {
  const { scopedLeads } = useRole();
  const updateLead = useUpdateLead();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [optimisticMoves, setOptimisticMoves] = useState<Map<string, string>>(new Map());

  const moveLead = useCallback((leadId: string, newStage: string, oldStage?: string) => {
    if (!leadId) return;
    const stageLabel = PIPELINE_STAGES.find(s => s.id === newStage)?.label ?? newStage;

    setOptimisticMoves(prev => new Map(prev).set(leadId, newStage));

    updateLead.mutate({ id: leadId, stage: newStage as any }, {
      onSuccess: () => toast.success(`Moved to ${stageLabel}`),
      onError: () => {
        if (oldStage) {
          setOptimisticMoves(prev => {
            const next = new Map(prev);
            next.set(leadId, oldStage);
            return next;
          });
        } else {
          setOptimisticMoves(prev => {
            const next = new Map(prev);
            next.delete(leadId);
            return next;
          });
        }
        toast.error("Failed to update lead");
      },
    });
  }, [updateLead]);

  const handleDragStart = useCallback((leadId: string) => {
    setDraggingId(leadId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverStage(null);
  }, []);

  const handleDragOver = useCallback((stageId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverStage(stageId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback((stageId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const leadId = event.dataTransfer.getData("text/plain");
    const lead = scopedLeads.find(l => l.id === leadId);
    const oldStage = lead?.stage;
    moveLead(leadId, stageId, oldStage);
    setDraggingId(null);
    setDragOverStage(null);
  }, [scopedLeads, moveLead]);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, typeof scopedLeads>();
    PIPELINE_STAGES.forEach(s => map.set(s.id, []));
    scopedLeads.forEach(lead => {
      const stage = optimisticMoves.get(lead.id) ?? lead.stage;
      const list = map.get(stage);
      if (list) list.push(lead);
    });
    return map;
  }, [scopedLeads, optimisticMoves]);

  return (
    <div>
      <PageHeader title="Pipeline" description="Drag and drop leads between stages." />
      <div className="overflow-x-auto p-6">
        <div className="flex gap-4 min-w-[900px]">
            {PIPELINE_STAGES.map(stage => {
              const stageLeads = leadsByStage.get(stage.id) ?? [];
              const isDragOver = dragOverStage === stage.id;
              return (
              <div key={stage.id} className="flex-1 min-w-[240px]">
                <Card className={`p-3 shadow-card transition-colors ${isDragOver ? "border-primary bg-primary/5" : ""}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <StageBadge stage={stage.id} />
                    <span className="text-xs text-muted-foreground">
                      {stageLeads.length}
                    </span>
                  </div>
                  <div
                    className="space-y-2 min-h-[120px] rounded-md p-1 transition-colors"
                    role="list"
                    aria-label={`${stage.label} stage`}
                    onDragOver={(event) => handleDragOver(stage.id, event)}
                    onDragLeave={handleDragLeave}
                    onDrop={(event) => handleDrop(stage.id, event)}
                  >
                    {stageLeads
                      .map((lead) => {
                        const isDragging = draggingId === lead.id;
                        return (
                        <Card
                          key={lead.id}
                          draggable
                          onDragStart={() => handleDragStart(lead.id)}
                          onDragEnd={handleDragEnd}
                          className={`p-3 shadow-sm transition-all ${
                            isDragging
                              ? "cursor-grabbing opacity-50 rotate-2 scale-95 border-dashed"
                              : "cursor-grab hover:shadow-md"
                          }`}
                          role="listitem"
                          aria-label={`Lead: ${lead.name}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-medium truncate">{lead.name}</span>
                                {lead.hot && <HotBadge />}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                            </div>
                            <UserAvatar userId={lead.assignedTo} size="sm" />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="font-semibold text-primary">{formatCurrency(lead.budget)}</span>
                            <span className="text-muted-foreground">{lead.source}</span>
                          </div>
                        </Card>
                        );
                      })}
                  </div>
                </Card>
              </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
