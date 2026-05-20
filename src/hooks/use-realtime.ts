/**
 * Real-time Updates Hook
 * Provides Supabase real-time subscriptions for live data synchronization
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type TableName = 'leads' | 'tasks' | 'appointments' | 'activities' | 'properties' | 'teams' | 'profiles';

interface UseRealtimeOptions {
  table: TableName;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  enabled?: boolean;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

/**
 * Subscribe to real-time changes for a specific table
 */
export function useRealtime(options: UseRealtimeOptions) {
  const {
    table,
    filter,
    event = '*',
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
  } = options;

  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Create unique channel name
    const channelName = `realtime:${table}${filter ? `:${filter}` : ''}`;

    // Subscribe to changes
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          filter,
        } as any,
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log(`[Realtime] ${table} ${payload.eventType}:`, payload);

          // Handle different event types
          switch (payload.eventType) {
            case 'INSERT':
              handleInsert(payload);
              onInsert?.(payload);
              break;
            case 'UPDATE':
              handleUpdate(payload);
              onUpdate?.(payload);
              break;
            case 'DELETE':
              handleDelete(payload);
              onDelete?.(payload);
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] ${channelName} subscription status:`, status);
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter, event, enabled]);

  const handleInsert = (payload: RealtimePostgresChangesPayload<any>) => {
    // Invalidate relevant queries to refetch data
    queryClient.invalidateQueries({ queryKey: [table] });
  };

  const handleUpdate = (payload: RealtimePostgresChangesPayload<any>) => {
    const newRecord = payload.new;
    const oldRecord = payload.old;

    // Update specific item in cache if we have the ID
    if (newRecord?.id) {
      queryClient.setQueryData([table, newRecord.id], newRecord);
    }

    // Invalidate list queries
    queryClient.invalidateQueries({ queryKey: [table] });
  };

  const handleDelete = (payload: RealtimePostgresChangesPayload<any>) => {
    const oldRecord = payload.old as { id?: string } | undefined;

    if (oldRecord?.id) {
      queryClient.removeQueries({ queryKey: [table, oldRecord.id] });
    }

    // Invalidate list queries
    queryClient.invalidateQueries({ queryKey: [table] });
  };
}

/**
 * Subscribe to real-time lead updates
 */
export function useRealtimeLeads(options?: {
  tenantId?: string;
  teamId?: string;
  enabled?: boolean;
}) {
  const { tenantId, teamId, enabled = true } = options || {};

  // Build filter based on options
  let filter: string | undefined;
  if (tenantId) {
    filter = `tenant_id=eq.${tenantId}`;
  } else if (teamId) {
    filter = `team_id=eq.${teamId}`;
  }

  useRealtime({
    table: 'leads',
    filter,
    enabled,
  });
}

/**
 * Subscribe to real-time task updates
 */
export function useRealtimeTasks(options?: {
  leadId?: string;
  assignedTo?: string;
  enabled?: boolean;
}) {
  const { leadId, assignedTo, enabled = true } = options || {};

  let filter: string | undefined;
  if (leadId) {
    filter = `lead_id=eq.${leadId}`;
  } else if (assignedTo) {
    filter = `assigned_to=eq.${assignedTo}`;
  }

  useRealtime({
    table: 'tasks',
    filter,
    enabled,
  });
}

/**
 * Subscribe to real-time appointment updates
 */
export function useRealtimeAppointments(options?: {
  leadId?: string;
  assignedTo?: string;
  enabled?: boolean;
}) {
  const { leadId, assignedTo, enabled = true } = options || {};

  let filter: string | undefined;
  if (leadId) {
    filter = `lead_id=eq.${leadId}`;
  } else if (assignedTo) {
    filter = `assigned_to=eq.${assignedTo}`;
  }

  useRealtime({
    table: 'appointments',
    filter,
    enabled,
  });
}

/**
 * Subscribe to real-time activity updates
 */
export function useRealtimeActivities(options?: {
  leadId?: string;
  enabled?: boolean;
}) {
  const { leadId, enabled = true } = options || {};

  const filter = leadId ? `lead_id=eq.${leadId}` : undefined;

  useRealtime({
    table: 'activities',
    filter,
    enabled,
  });
}

/**
 * Subscribe to real-time property updates
 */
export function useRealtimeProperties(options?: {
  tenantId?: string;
  enabled?: boolean;
}) {
  const { tenantId, enabled = true } = options || {};

  const filter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;

  useRealtime({
    table: 'properties',
    filter,
    enabled,
  });
}

/**
 * Subscribe to real-time team updates
 */
export function useRealtimeTeams(options?: {
  tenantId?: string;
  enabled?: boolean;
}) {
  const { tenantId, enabled = true } = options || {};

  const filter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;

  useRealtime({
    table: 'teams',
    filter,
    enabled,
  });
}

/**
 * Subscribe to real-time profile updates
 */
export function useRealtimeProfiles(options?: {
  tenantId?: string;
  enabled?: boolean;
}) {
  const { tenantId, enabled = true } = options || {};

  const filter = tenantId ? `tenant_id=eq.${tenantId}` : undefined;

  useRealtime({
    table: 'profiles',
    filter,
    enabled,
  });
}

/**
 * Subscribe to multiple tables at once
 */
export function useRealtimeSync(options: {
  leads?: boolean;
  tasks?: boolean;
  appointments?: boolean;
  activities?: boolean;
  properties?: boolean;
  teams?: boolean;
  profiles?: boolean;
  tenantId?: string;
  enabled?: boolean;
}) {
  const {
    leads = false,
    tasks = false,
    appointments = false,
    activities = false,
    properties = false,
    teams = false,
    profiles = false,
    tenantId,
    enabled = true,
  } = options;

  if (leads) {
    useRealtimeLeads({ tenantId, enabled });
  }

  if (tasks) {
    useRealtimeTasks({ enabled });
  }

  if (appointments) {
    useRealtimeAppointments({ enabled });
  }

  if (activities) {
    useRealtimeActivities({ enabled });
  }

  if (properties) {
    useRealtimeProperties({ tenantId, enabled });
  }

  if (teams) {
    useRealtimeTeams({ tenantId, enabled });
  }

  if (profiles) {
    useRealtimeProfiles({ tenantId, enabled });
  }
}

/**
 * Hook for presence tracking (who's online)
 */
export function usePresence(channelName: string, userId: string, enabled = true) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !userId) return;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    // Track presence
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('[Presence] Sync:', state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[Presence] Join:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[Presence] Leave:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channelName, userId, enabled]);

  return channelRef.current;
}

// Made with Bob
