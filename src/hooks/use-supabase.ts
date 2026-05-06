import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/types/database";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Tables = Database["public"]["Tables"];
type LeadInsert = Tables["leads"]["Insert"];
type LeadUpdate = Tables["leads"]["Update"];
type PropertyInsert = Tables["properties"]["Insert"];
type PropertyUpdate = Tables["properties"]["Update"];
type TaskInsert = Tables["tasks"]["Insert"];
type TaskUpdate = Tables["tasks"]["Update"];
type AppointmentInsert = Tables["appointments"]["Insert"];
type AppointmentUpdate = Tables["appointments"]["Update"];
type ActivityInsert = Tables["activities"]["Insert"];
type ApprovalInsert = Tables["approval_requests"]["Insert"];
type ApprovalUpdate = Tables["approval_requests"]["Update"];
type TeamInsert = Tables["teams"]["Insert"];
type ProfileUpdate = Tables["profiles"]["Update"];

// ========= LEADS =========
export function useLeads(filters?: {
  tenant_id?: string;
  stage?: string;
  hot?: boolean;
  assigned_to?: string;
  team_id?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["leads", filters],
    queryFn: async () => {
      let q = supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (filters?.tenant_id) q = q.eq("tenant_id", filters.tenant_id);
      if (filters?.stage) q = q.eq("stage", filters.stage);
      if (filters?.hot !== undefined) q = q.eq("hot", filters.hot);
      if (filters?.assigned_to) q = q.eq("assigned_to", filters.assigned_to);
      if (filters?.team_id) q = q.eq("team_id", filters.team_id);
      if (filters?.limit) q = q.limit(filters.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!filters?.tenant_id, // Require tenant_id to prevent unfiltered queries
    staleTime: 30_000,
  });
}

export function useLead(id?: string) {
  return useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

// Helper to batch fetch profiles by IDs
async function fetchProfilesByIds(ids: string[]) {
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, email, initials, avatar_color")
    .in("id", ids);
  return new Map(data?.map(p => [p.id, p]) || []);
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadInsert) => {
      const { data, error } = await supabase.from("leads").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Narrow invalidation to only queries matching this tenant
      qc.invalidateQueries({
        queryKey: ["leads"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id;
        }
      });
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: LeadUpdate & { id: string }) => {
      const { data, error } = await supabase.from("leads").update(input).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async vars => {
      // Cancel all lead queries for optimistic update
      await qc.cancelQueries({ queryKey: ["leads"] });
      const previousQueries: any[] = [];
      
      // Store all matching query data for rollback
      qc.getQueryCache().findAll({ queryKey: ["leads"] }).forEach(query => {
        const data = query.state.data;
        previousQueries.push({ key: query.queryKey, data });
        
        // Optimistically update matching queries
        qc.setQueryData(query.queryKey, (old: any[] | undefined) =>
          old?.map(l => l.id === vars.id ? { ...l, ...vars } : l)
        );
      });
      
      return { previousQueries };
    },
    onError: (_err, _vars, context: any) => {
      // Rollback all optimistic updates
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ key, data }: any) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: (data, vars) => {
      // Narrow invalidation to queries matching this tenant
      qc.invalidateQueries({
        queryKey: ["leads"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id;
        }
      });
      qc.invalidateQueries({ queryKey: ["lead", vars.id] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch lead first to get tenant_id for narrow invalidation
      const { data: lead } = await supabase.from("leads").select("tenant_id").eq("id", id).single();
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
      return lead;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["leads"] });
      const previousQueries: any[] = [];
      
      // Optimistically remove from all matching queries
      qc.getQueryCache().findAll({ queryKey: ["leads"] }).forEach(query => {
        const data = query.state.data;
        previousQueries.push({ key: query.queryKey, data });
        
        qc.setQueryData(query.queryKey, (old: any[] | undefined) =>
          old?.filter(l => l.id !== id)
        );
      });
      
      return { previousQueries };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ key, data }: any) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: (lead) => {
      if (lead?.tenant_id) {
        qc.invalidateQueries({
          queryKey: ["leads"],
          predicate: (query) => {
            const filters = query.queryKey[1] as any;
            return filters?.tenant_id === lead.tenant_id;
          }
        });
      }
    },
  });
}
// ========= BULK OPERATIONS =========
export function useBulkAssignLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lead_ids, assigned_to }: { lead_ids: string[]; assigned_to: string }) => {
      const { error } = await supabase.rpc("bulk_assign_leads", {
        _lead_ids: lead_ids,
        _assigned_to: assigned_to,
      });
      if (error) throw error;
      return { lead_ids, assigned_to };
    },
    onSuccess: (data) => {
      // Invalidate all lead queries (batch operation affects multiple leads)
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useBulkMoveLeadsStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lead_ids, stage }: { lead_ids: string[]; stage: string }) => {
      const { error } = await supabase.rpc("bulk_move_leads_stage", {
        _lead_ids: lead_ids,
        _stage: stage,
      });
      if (error) throw error;
      return { lead_ids, stage };
    },
    onSuccess: (data) => {
      // Invalidate all lead queries (batch operation affects multiple leads)
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}


// ========= PROPERTIES =========
export function useProperties(filters?: {
  type?: string;
  status?: string;
  tenant_id?: string | null;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["properties", filters],
    queryFn: async () => {
      let q = supabase.from("properties").select("*").order("created_at", { ascending: false });
      if (filters?.type) q = q.eq("type", filters.type);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.tenant_id !== undefined) q = q.eq("tenant_id", filters.tenant_id);
      if (filters?.limit) q = q.limit(filters.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!filters?.tenant_id,
    staleTime: 60_000,
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PropertyInsert) => {
      const { data, error } = await supabase.from("properties").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Narrow invalidation to queries matching this tenant
      qc.invalidateQueries({
        queryKey: ["properties"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id;
        }
      });
    },
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: PropertyUpdate & { id: string }) => {
      const { data, error } = await supabase.from("properties").update(input).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async vars => {
      await qc.cancelQueries({ queryKey: ["properties"] });
      const previousQueries: any[] = [];
      
      qc.getQueryCache().findAll({ queryKey: ["properties"] }).forEach(query => {
        const data = query.state.data;
        previousQueries.push({ key: query.queryKey, data });
        
        qc.setQueryData(query.queryKey, (old: any[] | undefined) =>
          old?.map(p => p.id === vars.id ? { ...p, ...vars } : p)
        );
      });
      
      return { previousQueries };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ key, data }: any) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({
        queryKey: ["properties"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id;
        }
      });
      qc.invalidateQueries({ queryKey: ["property", vars.id] });
    },
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: property } = await supabase.from("properties").select("tenant_id").eq("id", id).single();
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
      return property;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["properties"] });
      const previousQueries: any[] = [];
      
      qc.getQueryCache().findAll({ queryKey: ["properties"] }).forEach(query => {
        const data = query.state.data;
        previousQueries.push({ key: query.queryKey, data });
        
        qc.setQueryData(query.queryKey, (old: any[] | undefined) =>
          old?.filter(p => p.id !== id)
        );
      });
      
      return { previousQueries };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ key, data }: any) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: (property) => {
      if (property?.tenant_id) {
        qc.invalidateQueries({
          queryKey: ["properties"],
          predicate: (query) => {
            const filters = query.queryKey[1] as any;
            return filters?.tenant_id === property.tenant_id;
          }
        });
      }
    },
  });
}

// ========= TASKS =========
export function useTasks(filters?: {
  tenant_id?: string;
  assigned_to?: string;
  status?: string;
  lead_id?: string;
}) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select("id, title, status, priority, due_at, lead_id, assigned_to, created_at, tenant_id")
        .order("due_at", { ascending: true });

      if (filters?.tenant_id) q = q.eq("tenant_id", filters.tenant_id);
      if (filters?.assigned_to) q = q.eq("assigned_to", filters.assigned_to);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.lead_id) q = q.eq("lead_id", filters.lead_id);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!filters?.tenant_id || !!filters?.lead_id || !!filters?.assigned_to,
    staleTime: 30_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskInsert) => {
      const { data, error } = await supabase.from("tasks").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Narrow invalidation to queries matching tenant, lead, or assignee
      qc.invalidateQueries({
        queryKey: ["tasks"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id ||
                 filters?.lead_id === data.lead_id ||
                 filters?.assigned_to === data.assigned_to;
        }
      });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: TaskUpdate & { id: string }) => {
      const { data, error } = await supabase.from("tasks").update(input).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async vars => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const previousQueries: any[] = [];
      
      qc.getQueryCache().findAll({ queryKey: ["tasks"] }).forEach(query => {
        const data = query.state.data;
        previousQueries.push({ key: query.queryKey, data });
        
        qc.setQueryData(query.queryKey, (old: any[] | undefined) =>
          old?.map(t => t.id === vars.id ? { ...t, ...vars } : t)
        );
      });
      
      return { previousQueries };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ key, data }: any) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({
        queryKey: ["tasks"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id ||
                 filters?.lead_id === data.lead_id ||
                 filters?.assigned_to === data.assigned_to;
        }
      });
      qc.invalidateQueries({ queryKey: ["task", vars.id] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: task } = await supabase.from("tasks").select("tenant_id, lead_id, assigned_to").eq("id", id).single();
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      return task;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const previousQueries: any[] = [];
      
      qc.getQueryCache().findAll({ queryKey: ["tasks"] }).forEach(query => {
        const data = query.state.data;
        previousQueries.push({ key: query.queryKey, data });
        
        qc.setQueryData(query.queryKey, (old: any[] | undefined) =>
          old?.filter(t => t.id !== id)
        );
      });
      
      return { previousQueries };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ key, data }: any) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: (task) => {
      if (task) {
        qc.invalidateQueries({
          queryKey: ["tasks"],
          predicate: (query) => {
            const filters = query.queryKey[1] as any;
            return filters?.tenant_id === task.tenant_id ||
                   filters?.lead_id === task.lead_id ||
                   filters?.assigned_to === task.assigned_to;
          }
        });
      }
    },
  });
}

// ========= APPOINTMENTS =========
export function useAppointments(filters?: {
  tenant_id?: string;
  assigned_to?: string;
  status?: string;
  lead_id?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["appointments", filters],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("id, title, scheduled_at, status, location, lead_id, assigned_to, property_id, created_at, tenant_id")
        .order("scheduled_at", { ascending: true });

      if (filters?.tenant_id) q = q.eq("tenant_id", filters.tenant_id);
      if (filters?.assigned_to) q = q.eq("assigned_to", filters.assigned_to);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.lead_id) q = q.eq("lead_id", filters.lead_id);
      if (filters?.limit) q = q.limit(filters.limit);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!filters?.tenant_id || !!filters?.lead_id || !!filters?.assigned_to,
    staleTime: 30_000,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AppointmentInsert) => {
      const { data, error } = await supabase.from("appointments").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Narrow invalidation to queries matching tenant, lead, or assignee
      qc.invalidateQueries({
        queryKey: ["appointments"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id ||
                 filters?.lead_id === data.lead_id ||
                 filters?.assigned_to === data.assigned_to;
        }
      });
    },
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: AppointmentUpdate & { id: string }) => {
      const { data, error } = await supabase.from("appointments").update(input).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async vars => {
      await qc.cancelQueries({ queryKey: ["appointments"] });
      const previousQueries: any[] = [];
      
      qc.getQueryCache().findAll({ queryKey: ["appointments"] }).forEach(query => {
        const data = query.state.data;
        previousQueries.push({ key: query.queryKey, data });
        
        qc.setQueryData(query.queryKey, (old: any[] | undefined) =>
          old?.map(a => a.id === vars.id ? { ...a, ...vars } : a)
        );
      });
      
      return { previousQueries };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ key, data }: any) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({
        queryKey: ["appointments"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id ||
                 filters?.lead_id === data.lead_id ||
                 filters?.assigned_to === data.assigned_to;
        }
      });
      qc.invalidateQueries({ queryKey: ["appointment", vars.id] });
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: appointment } = await supabase.from("appointments").select("tenant_id, lead_id, assigned_to").eq("id", id).single();
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
      return appointment;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["appointments"] });
      const previousQueries: any[] = [];
      
      qc.getQueryCache().findAll({ queryKey: ["appointments"] }).forEach(query => {
        const data = query.state.data;
        previousQueries.push({ key: query.queryKey, data });
        
        qc.setQueryData(query.queryKey, (old: any[] | undefined) =>
          old?.filter(a => a.id !== id)
        );
      });
      
      return { previousQueries };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ key, data }: any) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: (appointment) => {
      if (appointment) {
        qc.invalidateQueries({
          queryKey: ["appointments"],
          predicate: (query) => {
            const filters = query.queryKey[1] as any;
            return filters?.tenant_id === appointment.tenant_id ||
                   filters?.lead_id === appointment.lead_id ||
                   filters?.assigned_to === appointment.assigned_to;
          }
        });
      }
    },
  });
}

// ========= ACTIVITIES =========
export function useActivities(leadId?: string) {
  return useQuery({
    queryKey: ["activities", leadId],
    queryFn: async () => {
      let q = supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false });
      if (leadId) q = q.eq("lead_id", leadId);
      const { data: activities, error } = await q;
      if (error) throw error;
      
      // Fetch user profiles separately
      if (activities && activities.length > 0) {
        const userIds = [...new Set(activities.map((a: any) => a.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, initials, avatar_color")
          .in("id", userIds);
        
        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        activities.forEach((a: any) => {
          (a as any).user = profileMap.get(a.user_id) || null;
        });
      }
      
      return activities;
    },
    enabled: !!leadId,
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ActivityInsert) => {
      const { data, error } = await supabase.from("activities").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Only invalidate the specific lead's activities
      if (data.lead_id) {
        qc.invalidateQueries({ queryKey: ["activities", data.lead_id] });
      }
    },
  });
}

  // ========= APPROVALS =========
export function useApprovals(filters?: { status?: string }) {
  const { profile, hasRole } = useAuth();
  const isSuperAdmin = hasRole("super_admin");
  return useQuery({
    queryKey: ["approvals", filters],
    queryFn: async () => {
      let q = supabase.from("approval_requests").select("*").order("created_at", { ascending: false });
      if (!isSuperAdmin && profile?.tenant_id) q = q.eq("tenant_id", profile.tenant_id);
      if (filters?.status) q = q.eq("status", filters.status);
      const { data: approvals, error } = await q;
      if (error) throw error;

      // Fetch requester and decider profiles, plus requester roles
      if (approvals && approvals.length > 0) {
        const userIds = [
          ...new Set([
            ...approvals.map((a: any) => a.requester_id),
            ...approvals.map((a: any) => a.decided_by).filter(Boolean)
          ])
        ];

        const [
          { data: profiles },
          { data: roles }
        ] = await Promise.all([
          supabase.from("profiles").select("id, name, email").in("id", userIds),
          supabase.from("user_roles").select("user_id, role").in("user_id", approvals.map((a: any) => a.requester_id))
        ]);

        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        const roleMap = new Map(roles?.map((r: any) => [r.user_id, r.role]) || []);

        approvals.forEach((a: any) => {
          (a as any).requester = profileMap.get(a.requester_id) || null;
          (a as any).decider = a.decided_by ? profileMap.get(a.decided_by) || null : null;
          (a as any).requester_role = roleMap.get(a.requester_id) || "agent";
        });
      }

      return approvals;
    },
  });
}

export function useCreateApproval() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ApprovalInsert, "requester_id">) => {
      const { data, error } = await supabase.from("approval_requests").insert({ ...input, requester_id: user!.id, tenant_id: profile?.tenant_id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Narrow invalidation to queries matching this tenant or status
      qc.invalidateQueries({
        queryKey: ["approvals"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          // Invalidate if no filters (all approvals) or matching status
          return !filters || filters.status === data.status;
        }
      });
    },
  });
}

export function useDecideApproval() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, decision_note }: { id: string; status: "approved" | "rejected"; decision_note?: string }) => {
      const { data, error } = await supabase
        .from("approval_requests")
        .update({ status, decided_by: user!.id, decided_at: new Date().toISOString(), decision_note })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["approvals"] });
      const previousQueries: any[] = [];
      
      qc.getQueryCache().findAll({ queryKey: ["approvals"] }).forEach(query => {
        const data = query.state.data;
        previousQueries.push({ key: query.queryKey, data });
        
        qc.setQueryData(query.queryKey, (old: any[] | undefined) =>
          old?.map(a => a.id === id ? { ...a, status } : a)
        );
      });
      
      return { previousQueries };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ key, data }: any) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSuccess: () => {
      // Invalidate all approval queries since status changed
      qc.invalidateQueries({ queryKey: ["approvals"] });
    },
  });
}

// ========= TEAMS =========
export function useTeams(tenantId?: string) {
  return useQuery({
    queryKey: ["teams", tenantId],
    queryFn: async () => {
      // Fetch teams - RLS policy already filters by tenant_id or super_admin role
      const { data: teams, error } = await supabase
        .from("teams")
        .select(`*`)
        .order("name");
      if (error) {
        console.error("Error fetching teams:", error);
        throw error;
      }
      
      // Fetch leader profiles separately
      if (teams && teams.length > 0) {
        const leaderIds = [...new Set(teams.map(t => t.leader_id).filter(Boolean))];
        if (leaderIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, initials, avatar_color")
            .in("id", leaderIds);
          
          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
          teams.forEach(team => {
            (team as any).leader = profileMap.get(team.leader_id) || null;
          });
        }
      }
      
      return teams;
    },
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TeamInsert) => {
      const { data, error } = await supabase.from("teams").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Narrow invalidation to queries matching this tenant
      qc.invalidateQueries({
        queryKey: ["teams"],
        predicate: (query) => {
          const tenantId = query.queryKey[1];
          return tenantId === data.tenant_id || !tenantId;
        }
      });
    },
  });
}

// ========= TENANTS =========
export function useTenants() {
  return useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useTenant(id?: string) {
  return useQuery({
    queryKey: ["tenant", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("tenants").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Tables["tenants"]["Update"]) => {
      const { data, error } = await supabase.from("tenants").update(input).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async vars => {
      await qc.cancelQueries({ queryKey: ["tenants"] });
      const previous = qc.getQueryData(["tenants"]);
      qc.setQueryData(["tenants"], (old: any[] | undefined) =>
        old?.map(t => t.id === vars.id ? { ...t, ...vars } : t)
      );
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previous) qc.setQueryData(["tenants"], context.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useApproveTenant() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { data, error } = await supabase.rpc("approve_tenant_signup", {
        _tenant_id: id,
        _approver_id: user!.id,
        _approve: approve,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, approve }) => {
      await qc.cancelQueries({ queryKey: ["tenants"] });
      const previous = qc.getQueryData(["tenants"]);
      
      qc.setQueryData(["tenants"], (old: any[] | undefined) =>
        old?.map(t => t.id === id ? { ...t, status: approve ? "active" : "rejected" } : t)
      );
      
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previous) {
        qc.setQueryData(["tenants"], context.previous);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenants"] }),
  });
}

// ========= PROFILES =========
export function useProfiles(tenant_id?: string) {
  return useQuery({
    queryKey: ["profiles", tenant_id],
    queryFn: async () => {
      // Build query with explicit field selection
      let q = supabase
        .from("profiles")
        .select("id, name, email, initials, avatar_color, team_id, tenant_id");
      
      if (tenant_id) q = q.eq("tenant_id", tenant_id);
      
      const { data: profiles, error } = await q;
      if (error) throw error;
      if (!profiles) return [];

      // Fetch roles only for these specific profiles
      const profileIds = profiles.map((p: any) => p.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profileIds);

      profiles.forEach((p: any) => {
        p.user_roles = roles?.filter((r: any) => r.user_id === p.id) || [];
      });

      return profiles;
    },
    enabled: !!tenant_id,
    staleTime: 60_000, // 1 minute - profiles don't change often
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ProfileUpdate & { id: string }) => {
      const { data, error } = await supabase.from("profiles").update(input).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Narrow invalidation to queries matching this tenant
      qc.invalidateQueries({
        queryKey: ["profiles"],
        predicate: (query) => {
          const tenantId = query.queryKey[1];
          return tenantId === data.tenant_id;
        }
      });
      
      // Invalidate related queries for this tenant only
      qc.invalidateQueries({
        queryKey: ["leads"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id || filters?.assigned_to === data.id;
        }
      });
      
      qc.invalidateQueries({
        queryKey: ["tasks"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id || filters?.assigned_to === data.id;
        }
      });
      
      qc.invalidateQueries({
        queryKey: ["appointments"],
        predicate: (query) => {
          const filters = query.queryKey[1] as any;
          return filters?.tenant_id === data.tenant_id || filters?.assigned_to === data.id;
        }
      });
    },
  });
}

// ========= DASHBOARD STATS =========
export function useDashboardStats() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["dashboard-stats", profile?.tenant_id],
    queryFn: async () => {
      const tenantId = profile?.tenant_id;
      const q = (tenantId ? supabase.from("leads") : supabase.from("leads"));
      const [leadsRes, wonRes, tasksRes, apptsRes, pipelineRes] = await Promise.all([
        supabase.from("leads").select("id, budget", { count: "exact" }).eq("tenant_id", tenantId || ""),
        supabase.from("leads").select("budget").eq("stage", "won").eq("tenant_id", tenantId || ""),
        supabase.from("tasks").select("id", { count: "exact" }).eq("status", "open"),
        supabase.from("appointments").select("id", { count: "exact" }).eq("status", "scheduled"),
        supabase.from("leads").select("stage").eq("tenant_id", tenantId || ""),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      return {
        totalLeads: leadsRes.count ?? 0,
        pipelineValue: (leadsRes.data ?? []).reduce((sum, l) => sum + Number(l.budget ?? 0), 0),
        wonRevenue: (wonRes.data ?? []).reduce((sum, l) => sum + Number(l.budget ?? 0), 0),
        openTasks: tasksRes.count ?? 0,
        upcomingAppts: apptsRes.count ?? 0,
        byStage: ((pipelineRes.data ?? []) as { stage: string }[]).reduce(
          (acc, l) => { acc[l.stage] = (acc[l.stage] || 0) + 1; return acc; },
          {} as Record<string, number>
        ),
      };
    },
  });
}

// ========= INVITATIONS =========
export function useInvitations(tenantId?: string) {
  return useQuery({
    queryKey: ["invitations", tenantId],
    queryFn: async () => {
      let q = supabase.from("invitations").select("*").order("created_at", { ascending: false });
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useCreateInvitation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenant_id, team_id, expires_in_hours = 168 }: { tenant_id: string; team_id?: string | null; expires_in_hours?: number }) => {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expires_at = new Date(Date.now() + expires_in_hours * 3600000).toISOString();
      const { data, error } = await supabase.from("invitations").insert({
        tenant_id,
        team_id: team_id || null,
        code,
        expires_at,
        is_active: true,
        created_by: user!.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Only invalidate queries for this specific tenant
      qc.invalidateQueries({ queryKey: ["invitations", data.tenant_id] });
    },
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tenant_id }: { id: string; tenant_id: string }) => {
      const { error } = await supabase.from("invitations").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      return tenant_id;
    },
    onMutate: async ({ id, tenant_id }) => {
      await qc.cancelQueries({ queryKey: ["invitations", tenant_id] });
      const previous = qc.getQueryData(["invitations", tenant_id]);
      
      qc.setQueryData(["invitations", tenant_id], (old: any[] | undefined) =>
        old?.map(inv => inv.id === id ? { ...inv, is_active: false } : inv)
      );
      
      return { previous, tenant_id };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previous && context?.tenant_id) {
        qc.setQueryData(["invitations", context.tenant_id], context.previous);
      }
    },
    onSuccess: (tenant_id) => {
      qc.invalidateQueries({ queryKey: ["invitations", tenant_id] });
    },
  });
}

export function useRedeemInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, userId }: { code: string; userId: string }) => {
      const { data, error } = await supabase.rpc("redeem_invitation", {
        _code: code,
        _user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate profiles and teams - these are already tenant-scoped in queries
      // so no need for predicate filtering
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

// ========= PLATFORM HEALTH =========
export function usePlatformHealth() {
  return useQuery({
    queryKey: ["platform-health"],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        tenantsRes,
        activeTenantsRes,
        recentLeadsRes,
        recentTasksRes,
        recentApptsRes,
        totalLeadsRes,
      ] = await Promise.all([
        supabase.from("tenants").select("id, status, created_at", { count: "exact" }),
        supabase.from("tenants").select("id", { count: "exact" }).eq("status", "active"),
        supabase.from("leads").select("id", { count: "exact" }).gte("created_at", thirtyDaysAgo),
        supabase.from("tasks").select("id", { count: "exact" }).gte("created_at", thirtyDaysAgo),
        supabase.from("appointments").select("id", { count: "exact" }).gte("created_at", thirtyDaysAgo),
        supabase.from("leads").select("id", { count: "exact" }),
      ]);

      if (tenantsRes.error) throw tenantsRes.error;

      const totalTenants = tenantsRes.count ?? 0;
      const activeTenants = activeTenantsRes.count ?? 0;
      const recentLeads = recentLeadsRes.count ?? 0;
      const recentTasks = recentTasksRes.count ?? 0;
      const recentAppts = recentApptsRes.count ?? 0;
      const totalLeads = totalLeadsRes.count ?? 0;

      // Calculate a simple health score based on active tenants ratio
      const healthScore = totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 100;

      return {
        totalTenants,
        activeTenants,
        healthScore,
        recentLeads,
        recentTasks,
        recentAppts,
        totalLeads,
        fetchedAt: new Date().toISOString(),
      };
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

// ========= ROLE MANAGEMENT =========
export function useUpdateUserRole() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "agent" | "leader" | "manager" }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
      return { userId, role };
    },
    onSuccess: () => {
      // Only invalidate queries for the current tenant
      if (profile?.tenant_id) {
        qc.invalidateQueries({ queryKey: ["profiles", profile.tenant_id] });
        qc.invalidateQueries({ queryKey: ["teams", profile.tenant_id] });
      }
    },
  });
}

export function useAssignTeam() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, teamId }: { userId: string; teamId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ team_id: teamId }).eq("id", userId);
      if (error) throw error;
      return { userId, teamId };
    },
    onSuccess: () => {
      // Only invalidate queries for the current tenant
      if (profile?.tenant_id) {
        qc.invalidateQueries({ queryKey: ["profiles", profile.tenant_id] });
        qc.invalidateQueries({ queryKey: ["teams", profile.tenant_id] });
      }
    },
  });
}

