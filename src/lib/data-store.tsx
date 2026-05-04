import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  LEADS as SEED_LEADS, TASKS as SEED_TASKS, APPOINTMENTS as SEED_APPTS,
  PROPERTIES as SEED_PROPS, USERS as SEED_USERS, TENANTS as SEED_TENANTS,
  ACTIVITIES as SEED_ACTS, ACTIVE_TENANT_ID,
} from "./mock-data";
import type {
  Lead, Task, Appointment, Property, User, Tenant, Activity,
  LeadStage, ActivityType, TaskStatus, AppointmentStatus,
} from "./types";

let _id = 1000;
const nid = (p: string) => `${p}${++_id}`;

interface Store {
  leads: Lead[];
  tasks: Task[];
  appointments: Appointment[];
  properties: Property[];
  users: User[];
  tenants: Tenant[];
  activities: Activity[];
  tenantTags: string[];

  // tags
  addTag: (tag: string) => void;

  // leads
  addLead: (l: Omit<Lead, "id" | "createdAt" | "updatedAt" | "lastActivityAt" | "tags"> & { tags?: string[] }) => Lead;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  deleteLeads: (ids: string[]) => void;
  setLeadStage: (id: string, stage: LeadStage) => void;
  assignLeads: (ids: string[], userId: string) => void;
  bulkSetStage: (ids: string[], stage: LeadStage) => void;

  // activities
  logActivity: (leadId: string, type: ActivityType, title: string, userId: string, description?: string) => void;

  // tasks
  addTask: (t: Omit<Task, "id" | "createdAt">) => Task;
  toggleTask: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;

  // appointments
  addAppointment: (a: Omit<Appointment, "id">) => Appointment;
  setAppointmentStatus: (id: string, status: AppointmentStatus) => void;

  // properties
  addProperty: (p: Omit<Property, "id">) => Property;

  // users
  addUser: (u: Omit<User, "id" | "initials" | "avatarColor">) => User;

  // tenants
  addTenant: (t: Omit<Tenant, "id" | "createdAt" | "leadsCount">) => Tenant;
  setTenantStatus: (id: string, status: Tenant["status"]) => void;
}

const Ctx = createContext<Store | null>(null);

const palette = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
const initialsOf = (name: string) =>
  name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export function DataProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(SEED_LEADS);
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [appointments, setAppointments] = useState<Appointment[]>(SEED_APPTS);
  const [properties, setProperties] = useState<Property[]>(SEED_PROPS);
  const [users, setUsers] = useState<User[]>(SEED_USERS);
  const [tenants, setTenants] = useState<Tenant[]>(SEED_TENANTS);
  const [activities, setActivities] = useState<Activity[]>(SEED_ACTS);
  const [tenantTags, setTenantTags] = useState<string[]>([
    "Investor", "VIP", "Mortgage", "Cash Buyer", "First Time Buyer", "Foreign"
  ]);

  const addTag: Store["addTag"] = useCallback((tag) => {
    setTenantTags(prev => prev.includes(tag) ? prev : [...prev, tag]);
  }, []);

  const logActivity = useCallback((leadId: string, type: ActivityType, title: string, userId: string, description?: string) => {
    setActivities(prev => [
      { id: nid("a"), leadId, type, title, description, userId, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, lastActivityAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : l));
  }, []);

  const addLead: Store["addLead"] = useCallback((l) => {
    const now = new Date().toISOString();
    const lead: Lead = {
      id: nid("l"),
      tags: l.tags ?? [],
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      ...l,
    };
    setLeads(prev => [lead, ...prev]);
    setActivities(prev => [
      { id: nid("a"), leadId: lead.id, type: "note", title: "Lead created", userId: lead.assignedTo, createdAt: now },
      ...prev,
    ]);
    return lead;
  }, []);

  const updateLead: Store["updateLead"] = useCallback((id, patch) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l));
  }, []);

  const deleteLeads: Store["deleteLeads"] = useCallback((ids) => {
    const set = new Set(ids);
    setLeads(prev => prev.filter(l => !set.has(l.id)));
    setActivities(prev => prev.filter(a => !set.has(a.leadId)));
    setTasks(prev => prev.filter(t => !t.leadId || !set.has(t.leadId)));
    setAppointments(prev => prev.filter(a => !set.has(a.leadId)));
  }, []);

  const setLeadStage: Store["setLeadStage"] = useCallback((id, stage) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage, updatedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString() } : l));
    const lead = leads.find(l => l.id === id);
    if (lead) {
      setActivities(prev => [
        { id: nid("a"), leadId: id, type: "stage_change", title: `Moved to ${stage}`, userId: lead.assignedTo, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    }
  }, [leads]);

  const assignLeads: Store["assignLeads"] = useCallback((ids, userId) => {
    const set = new Set(ids);
    setLeads(prev => prev.map(l => set.has(l.id) ? { ...l, assignedTo: userId, updatedAt: new Date().toISOString() } : l));
  }, []);

  const bulkSetStage: Store["bulkSetStage"] = useCallback((ids, stage) => {
    const set = new Set(ids);
    setLeads(prev => prev.map(l => set.has(l.id) ? { ...l, stage, updatedAt: new Date().toISOString() } : l));
  }, []);

  const addTask: Store["addTask"] = useCallback((t) => {
    const task: Task = { id: nid("t"), createdAt: new Date().toISOString(), ...t };
    setTasks(prev => [task, ...prev]);
    return task;
  }, []);

  const toggleTask: Store["toggleTask"] = useCallback((id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === "done" ? "open" : "done" } : t));
  }, []);

  const setTaskStatus: Store["setTaskStatus"] = useCallback((id, status) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, []);

  const addAppointment: Store["addAppointment"] = useCallback((a) => {
    const appt: Appointment = { id: nid("ap"), ...a };
    setAppointments(prev => [appt, ...prev]);
    return appt;
  }, []);

  const setAppointmentStatus: Store["setAppointmentStatus"] = useCallback((id, status) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }, []);

  const addProperty: Store["addProperty"] = useCallback((p) => {
    const prop: Property = { id: nid("p"), ...p };
    setProperties(prev => [prop, ...prev]);
    return prop;
  }, []);

  const addUser: Store["addUser"] = useCallback((u) => {
    const user: User = {
      id: nid("u"),
      initials: initialsOf(u.name),
      avatarColor: palette[Math.floor(Math.random() * palette.length)],
      ...u,
    };
    setUsers(prev => [...prev, user]);
    return user;
  }, []);

  const addTenant: Store["addTenant"] = useCallback((t) => {
    const tenant: Tenant = {
      id: nid("t"),
      createdAt: new Date().toISOString(),
      leadsCount: 0,
      ...t,
    };
    setTenants(prev => [tenant, ...prev]);
    return tenant;
  }, []);

  const setTenantStatus: Store["setTenantStatus"] = useCallback((id, status) => {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, []);

  const value: Store = {
    leads, tasks, appointments, properties, users, tenants, activities, tenantTags,
    addTag, addLead, updateLead, deleteLeads, setLeadStage, assignLeads, bulkSetStage,
    logActivity,
    addTask, toggleTask, setTaskStatus,
    addAppointment, setAppointmentStatus,
    addProperty, addUser, addTenant, setTenantStatus,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used within DataProvider");
  return v;
}

export { ACTIVE_TENANT_ID };
