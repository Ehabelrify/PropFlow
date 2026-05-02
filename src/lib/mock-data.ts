import type {
  User, Property, Lead, Activity, Task, Appointment, PipelineStageDef,
} from "./types";

export const PIPELINE_STAGES: PipelineStageDef[] = [
  { id: "new", label: "New", tone: "bg-info/10 text-info border-info/20" },
  { id: "contacted", label: "Contacted", tone: "bg-accent text-accent-foreground border-border" },
  { id: "qualified", label: "Qualified", tone: "bg-primary-soft text-primary border-primary/20" },
  { id: "viewing", label: "Viewing", tone: "bg-warning/15 text-warning-foreground border-warning/30" },
  { id: "negotiation", label: "Negotiation", tone: "bg-chart-5/15 text-chart-5 border-chart-5/30" },
  { id: "won", label: "Won", tone: "bg-success/15 text-success border-success/30" },
  { id: "lost", label: "Lost", tone: "bg-destructive/10 text-destructive border-destructive/20" },
];

export const USERS: User[] = [
  { id: "u1", name: "Layla Hassan", email: "layla@propflow.com", role: "admin", avatarColor: "bg-chart-1", initials: "LH" },
  { id: "u2", name: "Omar Khaled", email: "omar@propflow.com", role: "manager", avatarColor: "bg-chart-2", initials: "OK" },
  { id: "u3", name: "Nour Adel", email: "nour@propflow.com", role: "agent", avatarColor: "bg-chart-3", initials: "NA" },
  { id: "u4", name: "Mariam Sayed", email: "mariam@propflow.com", role: "agent", avatarColor: "bg-chart-4", initials: "MS" },
  { id: "u5", name: "Karim Fouad", email: "karim@propflow.com", role: "agent", avatarColor: "bg-chart-5", initials: "KF" },
];

export const CURRENT_USER = USERS[0];

export const PROPERTIES: Property[] = [
  { id: "p1", title: "Marina Bay Residence — 3BR Sea View", type: "apartment", status: "available", price: 8500000, bedrooms: 3, bathrooms: 2, area: 165, location: "New Cairo", developer: "Palm Hills", image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80&auto=format&fit=crop" },
  { id: "p2", title: "Garden Heights Villa — 5BR with Pool", type: "villa", status: "available", price: 24000000, bedrooms: 5, bathrooms: 4, area: 420, location: "Sheikh Zayed", developer: "SODIC", image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80&auto=format&fit=crop" },
  { id: "p3", title: "Downtown Lofts — Studio", type: "apartment", status: "reserved", price: 3200000, bedrooms: 0, bathrooms: 1, area: 65, location: "Maadi", developer: "Tatweer Misr", image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80&auto=format&fit=crop" },
  { id: "p4", title: "Skyline Tower — 2BR City View", type: "apartment", status: "available", price: 5800000, bedrooms: 2, bathrooms: 2, area: 110, location: "New Capital", developer: "Mountain View", image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80&auto=format&fit=crop" },
  { id: "p5", title: "Coral Bay Townhouse — 4BR", type: "townhouse", status: "available", price: 14500000, bedrooms: 4, bathrooms: 3, area: 280, location: "North Coast", developer: "Emaar", image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80&auto=format&fit=crop" },
  { id: "p6", title: "Pyramid View Office — 220m²", type: "office", status: "sold", price: 11000000, bedrooms: 0, bathrooms: 2, area: 220, location: "Giza", developer: "Hassan Allam", image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80&auto=format&fit=crop" },
];

const NAMES = [
  "Ahmed Mostafa", "Sara El-Masry", "Youssef Ibrahim", "Hana Farouk", "Tarek Aboul Naga",
  "Dina Saleh", "Hassan El-Shimy", "Rana Magdy", "Walid Sherif", "Yasmin Abdel Aziz",
  "Mahmoud Hosny", "Nadine Wahba", "Amr El-Banna", "Reem Tawfik", "Ziad Mansour",
  "Salma Refaat", "Khaled Naguib", "Farida Lotfy", "Bassel Khoury", "Maya Ezzat",
  "Hesham Galal", "Aya El-Sherbiny", "Ramy Anwar", "Nada Kassem", "Ibrahim Talaat",
  "Lina Helmy", "Tamer Ghoneim", "Heba Younes", "Sherif Bakr", "Mona Fathy",
];

const SOURCES = ["widget", "manual", "referral", "facebook", "google", "import"] as const;
const STAGES = ["new", "contacted", "qualified", "viewing", "negotiation", "won", "lost"] as const;
const TAGS = ["VIP", "Investor", "First-time buyer", "Cash buyer", "Mortgage", "Foreign", "Returning"];
const LOCATIONS = ["New Cairo", "Sheikh Zayed", "Maadi", "North Coast", "New Capital", "Giza"];

function rand<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Deterministic seed for stable mock data
let seed = 42;
function srand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
function spick<T>(arr: readonly T[]): T { return arr[Math.floor(srand() * arr.length)]; }
function sint(min: number, max: number) { return Math.floor(srand() * (max - min + 1)) + min; }

const now = new Date("2026-05-02T10:00:00Z").getTime();
const day = 24 * 60 * 60 * 1000;

export const LEADS: Lead[] = NAMES.map((name, i) => {
  const stage = spick(STAGES);
  const score = sint(20, 98);
  const createdDaysAgo = sint(0, 60);
  const lastDaysAgo = Math.min(createdDaysAgo, sint(0, 14));
  const slug = name.toLowerCase().replace(/[^a-z]/g, ".");
  return {
    id: `l${i + 1}`,
    name,
    email: `${slug}@example.com`,
    phone: `+20 10${sint(10000000, 99999999)}`,
    stage,
    source: spick(SOURCES),
    score,
    hot: score >= 75 && (stage === "qualified" || stage === "viewing" || stage === "negotiation"),
    budget: sint(2, 30) * 1000000,
    assignedTo: spick(USERS.filter(u => u.role === "agent" || u.role === "manager")).id,
    propertyInterest: srand() > 0.3 ? spick(PROPERTIES).id : undefined,
    tags: Array.from(new Set([spick(TAGS), spick(TAGS)])).slice(0, sint(1, 2)),
    createdAt: new Date(now - createdDaysAgo * day).toISOString(),
    updatedAt: new Date(now - lastDaysAgo * day).toISOString(),
    lastActivityAt: new Date(now - lastDaysAgo * day).toISOString(),
    utmSource: spick(["organic", "paid_social", "newsletter", "referral", "direct"]),
  };
});

export const ACTIVITIES: Activity[] = LEADS.flatMap((lead, i) => {
  const count = sint(2, 6);
  return Array.from({ length: count }).map((_, j) => {
    const types = ["call", "note", "email", "whatsapp", "stage_change"] as const;
    const type = spick(types);
    const titles: Record<string, string> = {
      call: "Outbound call",
      note: "Internal note",
      email: "Email sent",
      whatsapp: "WhatsApp message",
      stage_change: `Moved to ${lead.stage}`,
    };
    return {
      id: `a${i}-${j}`,
      leadId: lead.id,
      type,
      title: titles[type],
      description: type === "note" ? "Customer requested floor plans and payment plan details for the new project." : undefined,
      userId: lead.assignedTo,
      createdAt: new Date(now - sint(0, 30) * day - sint(0, 20) * 60 * 60 * 1000).toISOString(),
    };
  });
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const TASK_TITLES = [
  "Follow up on property tour",
  "Send updated payment plan",
  "Confirm site visit time",
  "Share floor plans",
  "Call back about financing",
  "Prepare offer document",
  "Reschedule viewing",
  "Send brochure",
];

export const TASKS: Task[] = Array.from({ length: 16 }).map((_, i) => {
  const lead = spick(LEADS);
  const dueDays = sint(-3, 10);
  return {
    id: `t${i + 1}`,
    title: spick(TASK_TITLES),
    leadId: lead.id,
    assignedTo: lead.assignedTo,
    priority: spick(["low", "medium", "high"] as const),
    status: spick(["open", "open", "in_progress", "done"] as const),
    dueAt: new Date(now + dueDays * day).toISOString(),
    createdAt: new Date(now - sint(0, 10) * day).toISOString(),
  };
});

export const APPOINTMENTS: Appointment[] = Array.from({ length: 12 }).map((_, i) => {
  const lead = spick(LEADS);
  const dayOffset = sint(-2, 14);
  const hour = sint(9, 17);
  const date = new Date(now + dayOffset * day);
  date.setUTCHours(hour, 0, 0, 0);
  return {
    id: `ap${i + 1}`,
    title: `Site visit — ${lead.name}`,
    leadId: lead.id,
    propertyId: spick(PROPERTIES).id,
    assignedTo: lead.assignedTo,
    status: dayOffset < 0 ? spick(["completed", "no_show", "cancelled"] as const) : "scheduled",
    scheduledAt: date.toISOString(),
    durationMin: spick([30, 45, 60, 90]),
    location: spick(LOCATIONS),
  };
});

export function getUser(id: string) { return USERS.find(u => u.id === id); }
export function getProperty(id?: string) { return id ? PROPERTIES.find(p => p.id === id) : undefined; }
export function getLead(id: string) { return LEADS.find(l => l.id === id); }
export function getStage(id: string) { return PIPELINE_STAGES.find(s => s.id === id); }

export function formatCurrency(n: number) {
  if (n >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `EGP ${(n / 1_000).toFixed(0)}K`;
  return `EGP ${n}`;
}
