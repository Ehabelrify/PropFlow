export type LeadStage = "new" | "contacted" | "qualified" | "viewing" | "negotiation" | "won" | "lost";
export type LeadSource = "widget" | "manual" | "referral" | "facebook" | "google" | "import";
export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type PropertyStatus = "available" | "reserved" | "sold";
export type PropertyType = "apartment" | "villa" | "townhouse" | "office" | "land";
export type ActivityType = "call" | "note" | "email" | "whatsapp" | "stage_change" | "appointment" | "task";
export type Role = "super_admin" | "manager" | "leader" | "agent";
// Extended role hierarchy for tenant org charts.
// "admin" is kept as alias of "manager" for backward compat with existing data.
export type OrgRole = "super_admin" | "manager" | "leader" | "agent";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "professional" | "enterprise";
  status: "active" | "suspended" | "trial";
  createdAt: string;
  seats: number;
  leadsCount: number;
}

export interface Team {
  id: string;
  tenantId: string;
  name: string;
  leaderId: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
  initials: string;
  tenantId?: string;
  teamId?: string;
}

export interface Property {
  id: string;
  title: string;
  type: PropertyType;
  status: PropertyStatus;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number; // sqm
  location: string;
  developer: string;
  image: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  stage: LeadStage;
  source: LeadSource;
  score: number; // 0-100
  hot: boolean;
  budget: number;
  assignedTo: string; // user id
  tenantId?: string;
  teamId?: string;
  propertyInterest?: string; // property id
  tags: string[];
  notes?: string;
  requirements?: {
    bedrooms?: number;
    bathrooms?: number;
    area?: number;
    location?: string;
  };
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  utmSource?: string;
  // Populated from joins
  tenant?: {
    id: string;
    name: string;
    status?: string;
  };
  team?: {
    id: string;
    name: string;
  };
  assigned_user?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export interface Activity {
  id: string;
  leadId: string;
  type: ActivityType;
  title: string;
  description?: string;
  userId: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  leadId?: string;
  assignedTo: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  title: string;
  leadId: string;
  propertyId?: string;
  assignedTo: string;
  status: AppointmentStatus;
  scheduledAt: string;
  durationMin: number;
  location?: string;
  notes?: string;
}

export interface PipelineStageDef {
  id: LeadStage;
  label: string;
  tone: string;
}
