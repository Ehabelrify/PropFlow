import { createFileRoute } from "@tanstack/react-router";
import type { DragEvent } from "react";
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

  const moveLead = (leadId: string, newStage: string) => {
    if (!leadId) return;
    const stageLabel = PIPELINE_STAGES.find(s => s.id === newStage)?.label ?? newStage;
    updateLead.mutate({ id: leadId, stage: newStage as any }, {
      onSuccess: () => toast.success(`Moved to ${stageLabel}`),
      onError: () => toast.error("Failed to update lead"),
    });
  };

  const handleDrop = (stageId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    moveLead(event.dataTransfer.getData("text/plain"), stageId);
  };

  return (
    <div>
      <PageHeader title="Pipeline" description="Drag and drop leads between stages." />
      <div className="overflow-x-auto p-6">
        {scopedLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">No leads in pipeline</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first lead to get started</p>
          </div>
        ) : (
          <div className="flex gap-4 min-w-[900px]">
            {PIPELINE_STAGES.map(stage => (
              <div key={stage.id} className="flex-1 min-w-[240px]">
                <Card className="p-3 shadow-card">
                  <div className="mb-2 flex items-center justify-between">
                    <StageBadge stage={stage.id} />
                    <span className="text-xs text-muted-foreground">
                      {scopedLeads.filter(l => l.stage === stage.id).length}
                    </span>
                  </div>
                  <div
                    className="space-y-2 min-h-[120px]"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(stage.id, event)}
                  >
                    {scopedLeads
                      .filter(l => l.stage === stage.id)
                      .map((lead) => (
                        <Card
                          key={lead.id}
                          draggable
                          onDragStart={(event) => event.dataTransfer.setData("text/plain", lead.id)}
                          className="p-3 cursor-grab active:cursor-grabbing shadow-sm"
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
                      ))}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
