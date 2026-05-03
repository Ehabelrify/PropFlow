import { createFileRoute, Link } from "@tanstack/react-router";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { PIPELINE_STAGES, formatCurrency } from "@/lib/mock-data";
import { useRole } from "@/lib/role-context";
import { useStore } from "@/lib/data-store";
import type { LeadStage } from "@/lib/types";
import { PageHeader } from "@/components/crm/PageHeader";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/crm/Avatar";
import { Plus, Flame } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { NewLeadDialog } from "@/components/crm/dialogs";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — PropFlow CRM" },
      { name: "description", content: "Drag-and-drop Kanban board for managing your real estate sales pipeline." },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const { scopedLeads, scopeLabel, has } = useRole();
  const { setLeadStage } = useStore();

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    const newStage = destination.droppableId as LeadStage;
    setLeadStage(draggableId, newStage);
    const lead = scopedLeads.find(l => l.id === draggableId);
    toast.success(`${lead?.name} moved to ${PIPELINE_STAGES.find(s => s.id === newStage)?.label}`);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <PageHeader
        title="Pipeline"
        description={`${scopeLabel} · drag leads between stages to update their status.`}
        actions={has("leads.create") ? (
          <NewLeadDialog trigger={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> New Lead</Button>} />
        ) : null}
      />
      <div className="min-h-0 flex-1 overflow-x-auto p-6">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full gap-4">
            {PIPELINE_STAGES.map(stage => {
              const stageLeads = scopedLeads.filter(l => l.stage === stage.id);
              const stageValue = stageLeads.reduce((s, l) => s + l.budget, 0);
              return (
                <div key={stage.id} className="flex h-full w-72 shrink-0 flex-col rounded-xl border bg-card shadow-card">
                  <div className="flex items-center justify-between border-b px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${stage.id === "won" ? "bg-success" : stage.id === "lost" ? "bg-destructive" : "bg-primary"}`} />
                      <span className="text-sm font-semibold">{stage.label}</span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">{stageLeads.length}</span>
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{formatCurrency(stageValue)}</span>
                  </div>
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[100px] flex-1 space-y-2 overflow-y-auto p-2 transition-colors ${snapshot.isDraggingOver ? "bg-primary-soft/40" : ""}`}
                      >
                        {stageLeads.map((lead, idx) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                            {(prov, snap) => (
                              <Link
                                to="/leads/$leadId"
                                params={{ leadId: lead.id }}
                                ref={prov.innerRef as any}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                className={`block rounded-lg border bg-background p-3 transition ${snap.isDragging ? "shadow-elevated ring-2 ring-primary/30" : "shadow-sm hover:shadow-card"}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium leading-tight">{lead.name}</p>
                                  {lead.hot && <Flame className="h-3.5 w-3.5 shrink-0 text-hot" />}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground capitalize">{lead.source}</p>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-xs font-semibold tabular-nums text-foreground">{formatCurrency(lead.budget)}</span>
                                  <UserAvatar userId={lead.assignedTo} size="xs" />
                                </div>
                                <div className="mt-2 flex items-center justify-between border-t pt-2">
                                  <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                                    <div className={`h-full ${lead.score >= 75 ? "bg-success" : lead.score >= 50 ? "bg-warning" : "bg-muted-foreground/40"}`} style={{ width: `${lead.score}%` }} />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(lead.lastActivityAt))}</span>
                                </div>
                              </Link>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
