import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft, Phone, Mail, MessageCircle, Calendar, Plus, MapPin, Building2,
  FileText, ArrowRight, CheckCircle2, Clock, CircleDot, Send, Flame, X, Tag, Edit3, PlusCircle,
  XCircle, Undo2,
} from "lucide-react";
import { formatCurrency, PIPELINE_STAGES } from "@/lib/constants";
import { useRole } from "@/lib/role-context";
import { useAuth } from "@/lib/auth-context";
import { useLead, useUpdateLead, useActivities, useTasks, useAppointments, useProperties, useCreateActivity, useProfiles, useUpdateTask } from "@/hooks/use-supabase";
import { useRealtimeActivities, useRealtimeTasks, useRealtimeAppointments } from "@/hooks/use-realtime";
import { PropertyImage } from "@/components/PropertyImage";
import { getPropertyImageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StageBadge } from "@/components/crm/StageBadge";
import { UserAvatar } from "@/components/crm/Avatar";
import { format, formatDistanceToNow } from "date-fns";
import { LogActivityDialog, ScheduleVisitDialog, NewTaskDialog } from "@/components/crm/dialogs";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type TimelineFilter = "all" | "calls" | "emails" | "notes" | "tasks" | "appointments" | "stages";

type TimelineEntry = {
  id: string;
  kind: "activity" | "task" | "appointment";
  sortDate: string;
  activity?: any;
  task?: any;
  appointment?: any;
};

const FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "notes", label: "Notes" },
  { key: "calls", label: "Calls" },
  { key: "emails", label: "Emails" },
  { key: "tasks", label: "Tasks" },
  { key: "appointments", label: "Visits" },
  { key: "stages", label: "Stages" },
];

function matchesFilter(entry: TimelineEntry, filter: TimelineFilter): boolean {
  if (filter === "all") return true;
  if (entry.kind === "task") return filter === "tasks";
  if (entry.kind === "appointment") return filter === "appointments";
  const t = entry.activity!.type;
  if (filter === "calls") return t === "call";
  if (filter === "emails") return t === "email";
  if (filter === "notes") return t === "note" || t === "whatsapp";
  if (filter === "stages") return t === "stage_change";
  return false;
}

function taskStatusIcon(status: string) {
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  if (status === "in_progress") return <Clock className="h-3.5 w-3.5 text-warning" />;
  return <CircleDot className="h-3.5 w-3.5" />;
}

function appointmentStatusBadge(status: string) {
  const map: Record<string, string> = {
    scheduled: "bg-info/15 text-info",
    completed: "bg-success/15 text-success",
    cancelled: "bg-destructive/10 text-destructive",
    no_show: "bg-warning/15 text-warning-foreground",
  };
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${map[status] ?? ``}`}>{status.replace(`_`, ` `)}</span>;
}

function priorityDot(priority: string) {
  const c = priority === "high" ? "bg-destructive" : priority === "medium" ? "bg-warning" : "bg-muted-foreground/40";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${c}`} />;
}

function LeadCompletionButtons({ leadId, currentStage }: { leadId: string; currentStage: string }) {
  const queryClient = useQueryClient();
  
  const updateLeadStageMutation = useMutation({
    mutationFn: async ({ stage, reason }: { stage: string; reason?: string }) => {
      const updates: any = {
        stage,
        updated_at: new Date().toISOString(),
      };
      
      // Set completion timestamps
      if (stage === "won") {
        updates.won_at = new Date().toISOString();
        updates.lost_at = null;
        updates.lost_reason = null;
      } else if (stage === "lost") {
        updates.lost_at = new Date().toISOString();
        updates.won_at = null;
        if (reason) updates.lost_reason = reason;
      }
      
      const { error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", leadId);
      
      if (error) throw error;
      
      // Log activity
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("activities").insert({
        lead_id: leadId,
        type: "stage_change",
        description: `Lead marked as ${stage}${reason ? `: ${reason}` : ''}`,
        created_by: user?.id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["activities", leadId] });
      toast.success(`Lead marked as ${variables.stage}`);
    },
    onError: (error) => {
      console.error("Error updating lead:", error);
      toast.error("Failed to update lead");
    },
  });
  
  const reopenLeadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({
          stage: "contacted",
          won_at: null,
          lost_at: null,
          lost_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);
      
      if (error) throw error;
      
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("activities").insert({
        lead_id: leadId,
        type: "stage_change",
        description: "Lead reopened",
        created_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead reopened");
    },
    onError: (error) => {
      console.error("Error reopening lead:", error);
      toast.error("Failed to reopen lead");
    },
  });
  
  const isCompleted = currentStage === "won" || currentStage === "lost";
  const isWon = currentStage === "won";
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {!isCompleted && (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" className="flex-1">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark as Won
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark Lead as Won?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move the lead to the "Won" stage and record the win timestamp.
                    You can reopen the lead later if needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => updateLeadStageMutation.mutate({ stage: "won" })}
                    disabled={updateLeadStageMutation.isPending}
                  >
                    {updateLeadStageMutation.isPending ? "Updating..." : "Confirm"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <XCircle className="mr-2 h-4 w-4" />
                  Mark as Lost
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark Lead as Lost?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move the lead to the "Lost" stage. You can optionally provide a reason.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <label className="text-sm font-medium">Reason (optional)</label>
                  <Textarea
                    id="lost-reason"
                    placeholder="e.g., Budget constraints, chose competitor, timing not right..."
                    className="mt-2"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      const reason = (document.getElementById("lost-reason") as HTMLTextAreaElement)?.value;
                      updateLeadStageMutation.mutate({ stage: "lost", reason });
                    }}
                    disabled={updateLeadStageMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {updateLeadStageMutation.isPending ? "Updating..." : "Confirm"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
        
        {isCompleted && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Undo2 className="mr-2 h-4 w-4" />
                Reopen Lead
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reopen Lead?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will move the lead back to "Contacted" stage and clear the {isWon ? "won" : "lost"} timestamp.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => reopenLeadMutation.mutate()}
                  disabled={reopenLeadMutation.isPending}
                >
                  {reopenLeadMutation.isPending ? "Reopening..." : "Reopen"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      
      {isCompleted && (
        <div className={`p-4 rounded-lg ${
          isWon ? 'bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800' :
                  'bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800'
        }`}>
          <p className={`text-sm font-medium ${isWon ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>
            {isWon ? '🎉 Lead Won!' : '❌ Lead Lost'}
          </p>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/leads/$leadId")({
  head: ({ params }) => ({
    meta: [
      { title: `Lead ${params.leadId} — PropFlow CRM` },
      { name: "description", content: "Lead detail with full activity timeline." },
    ],
  }),
  notFoundComponent: () => <div className="p-12 text-center text-sm text-muted-foreground">Lead not found.</div>,
  component: LeadDetail,
});

function LeadDetail() {
  const { leadId } = Route.useParams();
  const { user, orgRole } = useRole();
  const { profile } = useAuth();
  const { data: lead, isLoading } = useLead(leadId);
  const { data: activities = [] } = useActivities({ lead_id: leadId });
  const { data: tasks = [] } = useTasks({ lead_id: leadId });
  const { data: appointments = [] } = useAppointments({ lead_id: leadId });
  const { data: properties = [] } = useProperties({ tenant_id: lead?.tenant_id, limit: 50 });
  const { data: profiles = [] } = useProfiles(lead?.tenant_id);
  const updateLead = useUpdateLead();
  const createActivity = useCreateActivity();
  const updateTask = useUpdateTask();

  // Enable real-time updates for this lead's data
  useRealtimeActivities({ leadId, enabled: !!leadId });
  useRealtimeTasks({ leadId, enabled: !!leadId });
  useRealtimeAppointments({ leadId, enabled: !!leadId });

  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [noteText, setNoteText] = useState("");
  const [newTag, setNewTag] = useState("");
  const [reqEdits, setReqEdits] = useState(lead?.requirements || {});
  const [reqDialogOpen, setReqDialogOpen] = useState(false);

  // Memoized timeline - MUST be before any conditional returns
  const timeline = useMemo(() => {
    const entries: TimelineEntry[] = [];
    (activities || []).forEach(a => {
      entries.push({ id: a.id, kind: "activity", sortDate: a.created_at, activity: a });
    });
    (tasks || []).forEach(t => {
      entries.push({ id: `task-${t.id}`, kind: "task", sortDate: t.created_at, task: t });
    });
    (appointments || []).forEach(a => {
      entries.push({ id: `appt-${a.id}`, kind: "appointment", sortDate: a.scheduled_at, appointment: a });
    });
    return entries.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  }, [activities, tasks, appointments]);

  const filtered = useMemo(() => timeline.filter(e => matchesFilter(e, filter)), [timeline, filter]);

  useEffect(() => {
    if (lead?.requirements) setReqEdits(lead.requirements);
  }, [lead?.requirements]);

  if (isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading lead...</div>;
  if (!lead) return <div className="p-12 text-center text-sm text-muted-foreground">Lead not found.</div>;

  const owner = (profiles || []).find((p: any) => p.id === lead.assigned_to);
  const property = (properties || []).find(p => p.id === lead.property_interest);

  const submitNote = () => {
    if (!noteText.trim()) return;
    if (!user?.id) return toast.error("Sign in required");
    createActivity.mutate({
      lead_id: leadId,
      type: "note",
      title: "Note added",
      user_id: user.id,
      description: noteText.trim(),
      tenant_id: profile?.tenant_id ?? null,
    }, {
      onSuccess: () => {
        toast.success("Note added");
        setNoteText("");
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote();
  };

  const saveRequirements = () => {
    updateLead.mutate({ id: leadId, requirements: reqEdits });
    setReqDialogOpen(false);
    toast.success("Requirements updated");
  };

  const toggleLeadTag = (tag: string) => {
    const nextTags = (lead.tags ?? []).includes(tag)
      ? (lead.tags ?? []).filter((t: string) => t !== tag)
      : [...(lead.tags ?? []), tag];
    updateLead.mutate({ id: leadId, tags: nextTags });
  };

  const handleAddNewTag = () => {
    if (!newTag.trim()) return;
    const t = newTag.trim();
    if (!(lead.tags ?? []).includes(t)) {
      updateLead.mutate({ id: leadId, tags: [...(lead.tags ?? []), t] });
    }
    setNewTag("");
  };

  const handleTaskToggle = (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "open" : "done";
    updateTask.mutate(
      { id: taskId, status: newStatus as any },
      {
        onSuccess: () => {
          toast.success(newStatus === "done" ? "Task completed" : "Task reopened");
        },
        onError: (error: any) => {
          toast.error("Failed to update task");
          console.error("Task update error:", error);
        },
      }
    );
  };

  return (
    <div>
      <div className="border-b bg-gradient-subtle px-6 py-5">
        <Link to="/leads" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to leads
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand text-lg font-semibold text-primary-foreground shadow-sm">
                {lead.name.split(" ").map((n: string) => n[0]).join("").slice(0,2)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
                  <button onClick={() => updateLead.mutate({ id: leadId, hot: !lead.hot })} className={`flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${lead.hot ? `border-hot bg-hot/10 text-hot hover:bg-hot/20` : `border-border text-muted-foreground hover:bg-muted`}`}>
                    <Flame className="h-3 w-3" /> Hot
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                  {lead.email && <a href={`mailto:${lead.email}`} className="hover:text-foreground">{lead.email}</a>}
                  {lead.phone && <><span>·</span><a href={`tel:${lead.phone}`} className="hover:text-foreground">{lead.phone}</a></>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LogActivityDialog leadId={leadId} type="call" title="Log call" trigger={<Button size="sm" variant="outline"><Phone className="mr-1.5 h-3.5 w-3.5" /> Call</Button>} />
            <LogActivityDialog leadId={leadId} type="email" title="Log email" trigger={<Button size="sm" variant="outline"><Mail className="mr-1.5 h-3.5 w-3.5" /> Email</Button>} />
            <LogActivityDialog leadId={leadId} type="whatsapp" title="Log WhatsApp message" trigger={<Button size="sm" variant="outline"><MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp</Button>} />
            <ScheduleVisitDialog leadId={leadId} trigger={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Calendar className="mr-1.5 h-3.5 w-3.5" /> Schedule visit</Button>} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5 shadow-card">
            <h3 className="text-sm font-semibold">Pipeline stage</h3>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {PIPELINE_STAGES.filter(s => s.id !== "lost").map((s, i, arr) => {
                const currentIdx = arr.findIndex(x => x.id === lead.stage);
                const reached = i <= currentIdx;
                return (
                  <div key={s.id} className="flex items-center">
                    <button onClick={() => updateLead.mutate({ id: leadId, stage: s.id as any })} className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition ${reached ? `border-primary bg-primary text-primary-foreground` : `border-border bg-muted/40 text-muted-foreground hover:bg-muted`}`}>
                      {s.label}
                    </button>
                    {i < arr.length - 1 && <div className={`mx-0.5 h-px w-3 ${reached && i < currentIdx ? `bg-primary` : `bg-border`}`} />}
                  </div>
                );
              })}
              <button onClick={() => updateLead.mutate({ id: leadId, stage: "lost" as any })} className={`ml-2 rounded-full border px-2.5 py-1 text-xs font-medium transition ${lead.stage === "lost" ? "border-destructive bg-destructive text-destructive-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                Lost
              </button>
            </div>
          </Card>

          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Timeline</h3>
              <div className="flex items-center gap-1">
                <NewTaskDialog leadId={leadId} trigger={<Button size="sm" variant="ghost" className="h-7 text-xs"><Plus className="mr-1 h-3 w-3" /> Task</Button>} />
                <LogActivityDialog leadId={leadId} type="note" title="Add note" trigger={<Button size="sm" variant="ghost" className="h-7 text-xs"><FileText className="mr-1 h-3 w-3" /> Note</Button>} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${filter === f.key ? `bg-primary text-primary-foreground shadow-sm` : `text-muted-foreground hover:bg-muted hover:text-foreground`}`}>
                  {f.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={handleNoteKeyDown} placeholder="Add a quick note..." rows={2} className="min-h-[60px] resize-none text-sm" />
              <Button size="icon" onClick={submitNote} disabled={!noteText.trim()} className="h-[60px] w-10 shrink-0 bg-gradient-brand text-primary-foreground disabled:opacity-40">
                <Send className="h-4 w-4" />
              </Button>
            </div>

            <ol className="mt-4 space-y-1">
              {filtered.map((entry, i) => (
                <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < filtered.length - 1 && <div className="absolute left-[14px] top-7 h-full w-px bg-border" />}
                  <div className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                    entry.kind === "task" ? "border-chart-5/30 bg-chart-5/10" :
                    entry.kind === "appointment" ? "border-info/30 bg-info/10" :
                    "bg-card"
                  } text-muted-foreground`}>
                    {entry.kind === "activity" && entry.activity?.type === "call" && <Phone className="h-3.5 w-3.5" />}
                    {entry.kind === "activity" && entry.activity?.type === "email" && <Mail className="h-3.5 w-3.5" />}
                    {entry.kind === "activity" && entry.activity?.type === "whatsapp" && <MessageCircle className="h-3.5 w-3.5" />}
                    {entry.kind === "activity" && entry.activity?.type === "note" && <FileText className="h-3.5 w-3.5" />}
                    {entry.kind === "activity" && entry.activity?.type === "stage_change" && <ArrowRight className="h-3.5 w-3.5" />}
                    {entry.kind === "activity" && entry.activity?.type === "appointment" && <Calendar className="h-3.5 w-3.5" />}
                    {entry.kind === "activity" && entry.activity?.type === "task" && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {entry.kind === "task" && <CheckCircle2 className="h-3.5 w-3.5 text-chart-5" />}
                    {entry.kind === "appointment" && <Calendar className="h-3.5 w-3.5 text-info" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    {entry.kind === "activity" && entry.activity && (
                      <>
                        <p className="text-sm">
                          <span className="font-medium">{entry.activity.title}</span>{" "}
                          <span className="text-muted-foreground">by {(entry.activity as any).user?.name ?? "Unknown"}</span>
                        </p>
                        {entry.activity.description && (
                          <p className="mt-1 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{entry.activity.description}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">{format(new Date(entry.activity.created_at), "MMM d, yyyy · h:mm a")}</p>
                      </>
                    )}

                    {entry.kind === "task" && entry.task && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{entry.task.title}</span>
                          {taskStatusIcon(entry.task.status)}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">{priorityDot(entry.task.priority)} {entry.task.priority}</span>
                          <span>·</span>
                          <span>Due {format(new Date(entry.task.due_at), "MMM d")}</span>
                          <span>·</span>
                          <span>{(entry.task as any).assigned_user?.name ?? "Unknown"}</span>
                        </div>
                        {entry.task.status !== "done" && (
                          <button
                            onClick={() => handleTaskToggle(entry.task.id, entry.task.status)}
                            disabled={updateTask.isPending}
                            className="mt-1.5 text-[11px] font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Mark complete
                          </button>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">Created {format(new Date(entry.task.created_at), "MMM d, yyyy")}</p>
                      </>
                    )}

                    {entry.kind === "appointment" && entry.appointment && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{entry.appointment.title}</span>
                          {appointmentStatusBadge(entry.appointment.status)}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(new Date(entry.appointment.scheduled_at), "MMM d · h:mm a")}</span>
                          <span>·</span>
                          <span>{entry.appointment.duration_min} min</span>
                          {entry.appointment.location && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {entry.appointment.location}</span>
                            </>
                          )}
                        </div>
                        {entry.appointment.notes && (
                          <p className="mt-1 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{entry.appointment.notes}</p>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
              {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No timeline entries match this filter.</p>}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 shadow-card">
            <h3 className="text-sm font-semibold">Details</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Stage</dt><dd><StageBadge stage={lead.stage as any} /></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Score</dt><dd className="font-medium tabular-nums">{lead.score}/100</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Budget</dt><dd className="font-medium tabular-nums">{formatCurrency(Number(lead.budget))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Source</dt><dd className="capitalize">{lead.source}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">UTM</dt><dd className="text-xs">{lead.utm_source}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Owner</dt><dd>{owner && <div className="flex items-center gap-1.5"><UserAvatar userId={owner.id} /><span className="text-xs">{owner.name}</span></div>}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd className="text-xs">{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}</dd></div>
            </dl>
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tags</h4>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground"><PlusCircle className="h-3 w-3" /></Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-3">
                    <h4 className="mb-2 text-sm font-semibold">Manage Tags</h4>
                    <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                      {["Investor", "VIP", "Mortgage", "Cash Buyer", "First Time Buyer", "Foreign"].map(t => (
                        <label key={t} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                          <input type="checkbox" checked={(lead.tags ?? []).includes(t)} onChange={() => toggleLeadTag(t)} className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5" />
                          <span className="text-sm">{t}</span>
                        </label>
                      ))}
                    </div>
                    {["super_admin", "manager", "leader"].includes(orgRole) && (
                      <div className="mt-3 flex items-center gap-2 border-t pt-3">
                        <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="New tag..." className="h-8 text-xs" />
                        <Button size="sm" onClick={handleAddNewTag} className="h-8 px-2" disabled={!newTag.trim()}>Add</Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(lead.tags ?? []).length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
                {(lead.tags ?? []).map((t: string) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-5 shadow-card">
            <h3 className="text-sm font-semibold mb-4">Lead Status</h3>
            <LeadCompletionButtons leadId={leadId} currentStage={lead.stage} />
          </Card>

          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Requirements</h3>
              <Dialog open={reqDialogOpen} onOpenChange={(o) => { setReqDialogOpen(o); if (o) setReqEdits(lead.requirements || {}); }}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"><Edit3 className="h-3.5 w-3.5" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Requirements</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="bedrooms" className="text-right text-xs">Bedrooms</Label>
                      <Input id="bedrooms" type="number" value={(reqEdits as any).bedrooms || ""} onChange={e => setReqEdits({...reqEdits, bedrooms: parseInt(e.target.value) || undefined})} className="col-span-3 h-8" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="bathrooms" className="text-right text-xs">Bathrooms</Label>
                      <Input id="bathrooms" type="number" value={(reqEdits as any).bathrooms || ""} onChange={e => setReqEdits({...reqEdits, bathrooms: parseInt(e.target.value) || undefined})} className="col-span-3 h-8" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="area" className="text-right text-xs">Area (sqm)</Label>
                      <Input id="area" type="number" value={(reqEdits as any).area || ""} onChange={e => setReqEdits({...reqEdits, area: parseInt(e.target.value) || undefined})} className="col-span-3 h-8" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="location" className="text-right text-xs">Location</Label>
                      <Input id="location" value={(reqEdits as any).location || ""} onChange={e => setReqEdits({...reqEdits, location: e.target.value})} className="col-span-3 h-8" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={saveRequirements}>Save</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Bedrooms</dt><dd className="font-medium">{(lead.requirements as any)?.bedrooms || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Bathrooms</dt><dd className="font-medium">{(lead.requirements as any)?.bathrooms || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Area</dt><dd className="font-medium">{(lead.requirements as any)?.area ? `${(lead.requirements as any).area} sqm` : "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Location</dt><dd className="font-medium capitalize">{(lead.requirements as any)?.location || "-"}</dd></div>
            </dl>
          </Card>

          {property ? (
            <Card className="overflow-hidden shadow-card">
              <PropertyImage
                src={getPropertyImageUrl(property.image)}
                alt={property.title}
                className="h-32 w-full object-cover"
                fallbackClassName="h-32 w-full"
              />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Interested in</p>
                  <Button variant="ghost" size="icon" onClick={() => updateLead.mutate({ id: leadId, property_interest: null })} className="h-6 w-6 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></Button>
                </div>
                <h4 className="mt-1 text-sm font-semibold">{property.title}</h4>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {property.location}
                  <span>·</span>
                  <Building2 className="h-3 w-3" /> {property.developer}
                </div>
                <p className="mt-2 text-sm font-bold text-primary">{formatCurrency(Number(property.price))}</p>
              </div>
            </Card>
          ) : (
            <Card className="p-5 shadow-card flex flex-col items-center justify-center text-center">
              <Building2 className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="mb-3 text-sm text-muted-foreground">No property selected</p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">Select Property</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Property Interest</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4 max-h-[60vh] overflow-y-auto">
                    {properties.map(p => (
                      <button key={p.id} onClick={() => updateLead.mutate({ id: leadId, property_interest: p.id })} className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50">
                        <PropertyImage
                          src={getPropertyImageUrl(p.image)}
                          alt={p.title}
                          className="h-12 w-16 rounded object-cover"
                          fallbackClassName="h-12 w-16 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.location} · {formatCurrency(Number(p.price))}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          )}

          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tasks</h3>
              <NewTaskDialog leadId={leadId} trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Plus className="h-3.5 w-3.5" /></Button>} />
            </div>
            <ul className="mt-2 space-y-2">
              {(tasks as any[]).length === 0 && <p className="text-xs text-muted-foreground">No tasks yet</p>}
              {(tasks as any[]).map(t => (
                <li key={t.id} className="flex items-start gap-2 rounded p-1.5 hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={t.status === "done"}
                    onChange={() => handleTaskToggle(t.id, t.status)}
                    disabled={updateTask.isPending}
                    className="mt-1 h-3.5 w-3.5 rounded border-border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs ${t.status === `done` ? `line-through text-muted-foreground` : ``}`}>{t.title}</p>
                    <p className="text-[10px] text-muted-foreground">Due {format(new Date(t.due_at), "MMM d")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {(appointments as any[]).length > 0 && (
            <Card className="p-5 shadow-card">
              <h3 className="text-sm font-semibold">Appointments</h3>
              <ul className="mt-2 space-y-2">
                {(appointments as any[]).map(a => (
                  <li key={a.id} className="rounded p-1.5 text-xs hover:bg-muted/50">
                    <p className="font-medium">{format(new Date(a.scheduled_at), "MMM d, h:mm a")}</p>
                    <p className="text-muted-foreground capitalize">{a.location} · {a.status}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
