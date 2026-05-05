import { createFileRoute } from "@tanstack/react-router";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
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

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const leadId = result.draggableId;
    const newStage = result.destination.droppableId;
    const stageLabel = PIPELINE_STAGES.find(s => s.id === newStage)?.label ?? newStage;
    updateLead.mutate({ id: leadId, stage: newStage }, {
      onSuccess: () => toast.success(`Moved to ${stageLabel}`),
      onError: () => toast.error("Failed to update lead"),
    });
  };

  return (
    <div>
      <PageHeader title="Pipeline" description="Drag and drop leads between stages." />
      <div className="overflow-x-auto p-6">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 min-w-[900px]">
            {PIPELINE_STAGES.map(stage => (
              <Droppable key={stage.id} droppableId={stage.id}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 min-w-[240px]">
                    <Card className="p-3 shadow-card">
                      <div className="mb-2 flex items-center justify-between">
                        <StageBadge stage={stage.id} />
                        <span className="text-xs text-muted-foreground">
                          {scopedLeads.filter(l => l.stage === stage.id).length}
                        </span>
                      </div>
                      <div className="space-y-2 min-h-[120px]">
                        {scopedLeads
                          .filter(l => l.stage === stage.id)
                          .map((lead, idx) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                              {(provided) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
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
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                      </div>
                    </Card>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
