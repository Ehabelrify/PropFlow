# RLS Team-Based Filtering Documentation

## Overview

This document describes the enhanced Row Level Security (RLS) policies implemented to prevent data leakage between teams within the same tenant in PropFlow CRM.

**Migration:** [`010_enhance_rls_team_filtering.sql`](../supabase/migrations/010_enhance_rls_team_filtering.sql)  
**Issue:** #9 - Missing RLS Team Filtering  
**Severity:** Critical Security  
**Date:** 2026-05-15

## Problem Statement

The original RLS policies only filtered data by `tenant_id`, which meant:
- Team leaders could see leads from other teams in the same tenant
- Agents could potentially access data from other teams
- No proper team-based data isolation existed
- Risk of data leakage between teams

## Solution

Implemented comprehensive team-based RLS policies with the following hierarchy:

### Access Control Hierarchy

```
Super Admin (role: super_admin, team_id: NULL)
    ↓ Can see ALL data across ALL tenants
    
Tenant Manager (role: manager, team_id: NULL)
    ↓ Can see ALL data within their tenant
    
Team Leader (role: leader/manager, team_id: NOT NULL)
    ↓ Can see ONLY their team's data
    
Agent (role: agent)
    ↓ Can see ONLY assigned data
```

## Helper Functions

Three new helper functions were added to support team-based access control:

### 1. `current_user_team_id()`
Returns the current user's team_id from their profile.

```sql
SELECT public.current_user_team_id();
-- Returns: 'team-a' or NULL
```

### 2. `is_team_leader()`
Checks if the current user is a team leader (has leader/manager role AND a team_id).

```sql
SELECT public.is_team_leader();
-- Returns: true or false
```

### 3. `is_tenant_manager()`
Checks if the current user is a tenant-level manager (has manager role WITHOUT a team_id).

```sql
SELECT public.is_tenant_manager();
-- Returns: true or false
```

## Policy Structure

Each table now has separate policies for each role level:

### Leads Table Policies

| Policy Name | Role | Access Level |
|------------|------|--------------|
| `leads_super_admin_all` | Super Admin | All leads across all tenants |
| `leads_tenant_manager_all` | Tenant Manager | All leads in tenant |
| `leads_team_leader_team_only` | Team Leader | Only team's leads |
| `leads_agent_assigned_only` | Agent | Only assigned leads |

**Write Operations:**
- INSERT: Any authenticated user in their tenant
- UPDATE: Based on role hierarchy (super admin → manager → team leader → agent)
- DELETE: Only managers and super admins

### Tasks Table Policies

| Policy Name | Role | Access Level |
|------------|------|--------------|
| `tasks_super_admin_all` | Super Admin | All tasks |
| `tasks_tenant_manager_all` | Tenant Manager | All tenant tasks |
| `tasks_team_leader_team_only` | Team Leader | Tasks for team's leads |
| `tasks_agent_assigned` | Agent | Assigned tasks or tasks for assigned leads |

**Write Operations:**
- Separate policies for each role level
- Team leaders can manage tasks for their team's leads
- Agents can only manage their own tasks

### Activities Table Policies

| Policy Name | Role | Access Level |
|------------|------|--------------|
| `activities_super_admin_all` | Super Admin | All activities |
| `activities_tenant_manager_all` | Tenant Manager | All tenant activities |
| `activities_team_leader_team_only` | Team Leader | Activities for team's leads |
| `activities_agent_assigned` | Agent | Activities for assigned leads |

**Write Operations:**
- INSERT: Users can create activities for leads they can access
- Enforces user_id = auth.uid() for activity creation

### Appointments Table Policies

| Policy Name | Role | Access Level |
|------------|------|--------------|
| `appointments_super_admin_all` | Super Admin | All appointments |
| `appointments_tenant_manager_all` | Tenant Manager | All tenant appointments |
| `appointments_team_leader_team_only` | Team Leader | Appointments for team's leads |
| `appointments_agent_assigned` | Agent | Assigned appointments or for assigned leads |

**Write Operations:**
- Similar structure to tasks
- Team leaders can manage appointments for their team
- Agents can only manage their own appointments

## Key Security Features

### 1. Team Isolation
Team leaders with `team_id` set can ONLY see data from their specific team:

```sql
-- Team Leader A (team_id = 'team-a')
SELECT * FROM leads;
-- Returns: Only leads where team_id = 'team-a'

-- Cannot see Team B's data
SELECT * FROM leads WHERE team_id = 'team-b';
-- Returns: 0 rows (RLS blocks access)
```

### 2. Tenant Manager Distinction
Managers without a `team_id` can see all tenant data:

```sql
-- Tenant Manager (team_id = NULL)
SELECT * FROM leads WHERE tenant_id = 'my-tenant';
-- Returns: All leads in the tenant, regardless of team
```

### 3. Agent Restrictions
Agents can only see data explicitly assigned to them:

```sql
-- Agent
SELECT * FROM leads;
-- Returns: Only leads where assigned_to = auth.uid()
```

### 4. Cascading Access
Related data (tasks, activities, appointments) automatically respects lead-level access:

```sql
-- If a team leader can't see a lead, they also can't see:
-- - Tasks for that lead
-- - Activities for that lead
-- - Appointments for that lead
```

## Testing

A comprehensive test script is provided: [`010_test_rls_policies.sql`](../supabase/migrations/010_test_rls_policies.sql)

### Test Scenarios

1. **Super Admin Access** - Verify access to all data
2. **Tenant Manager Access** - Verify access to all tenant data
3. **Team Leader Access** - Verify access only to team data
4. **Agent Access** - Verify access only to assigned data
5. **Cross-Team Data Leakage** - Verify Team A cannot see Team B data
6. **Related Data Access** - Verify tasks/activities/appointments follow lead access

### Running Tests

```bash
# 1. Create test users via Supabase Auth
# 2. Set up test data using the test script
# 3. Log in as each user type
# 4. Run verification queries
# 5. Confirm expected results
```

## Migration Application

### Apply the Migration

```bash
# Using Supabase CLI
supabase db push

# Or apply specific migration
supabase migration up
```

### Verify Migration

```sql
-- Check that new policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('leads', 'tasks', 'activities', 'appointments')
ORDER BY tablename, policyname;

-- Check helper functions exist
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('current_user_team_id', 'is_team_leader', 'is_tenant_manager');
```

## Performance Considerations

### Indexes
The existing indexes on `tenant_id`, `team_id`, and `assigned_to` columns support these policies efficiently:

```sql
-- From migration 009_performance_indexes.sql
CREATE INDEX IF NOT EXISTS idx_leads_tenant_team ON leads(tenant_id, team_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
```

### Query Performance
- Policies use EXISTS subqueries for related data checks
- Helper functions are marked as STABLE for query optimization
- Policies are evaluated at the database level (no application overhead)

## Security Best Practices

### 1. Always Set team_id
When creating leads, always set the `team_id`:

```typescript
const { data, error } = await supabase
  .from('leads')
  .insert({
    name: 'John Doe',
    tenant_id: currentTenant,
    team_id: currentTeam, // REQUIRED for proper isolation
    assigned_to: agentId
  });
```

### 2. Validate User Context
Before operations, verify user has appropriate role:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('team_id, tenant_id')
  .eq('id', userId)
  .single();

// Verify team_id matches expected team
```

### 3. Audit Access Patterns
Monitor for unusual access patterns:

```sql
-- Check for cross-team access attempts (should be 0)
SELECT COUNT(*) 
FROM leads l
JOIN profiles p ON p.id = auth.uid()
WHERE l.team_id != p.team_id
AND p.team_id IS NOT NULL;
```

## Rollback Plan

If issues arise, the migration can be rolled back:

```sql
-- Restore original policies from migration 001
-- This would require creating a rollback migration
-- that restores the original tenant-only filtering
```

## Related Documentation

- [Database Schema](../supabase/migrations/001_complete_schema.sql)
- [Performance Indexes](../supabase/migrations/009_performance_indexes.sql)
- [Issue #9 - Missing RLS Team Filtering](../ISSUES_AND_FIX_PLAN.md)

## Support

For questions or issues related to RLS policies:
1. Check test script results
2. Verify user roles and team assignments
3. Review policy definitions in migration file
4. Check Supabase logs for RLS violations

## Changelog

### 2026-05-15 - Initial Implementation
- Added three helper functions for team-based access control
- Implemented separate policies for each role level
- Added comprehensive test suite
- Documented all policies and access patterns
- Verified no data leakage between teams