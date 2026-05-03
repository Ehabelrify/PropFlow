import { useState, type ReactNode } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/data-store";
import { useRole } from "@/lib/role-context";
import { PIPELINE_STAGES } from "@/lib/mock-data";
import { toast } from "sonner";
import type { Lead, LeadSource, LeadStage, TaskPriority, PropertyType, PropertyStatus } from "@/lib/types";

/* ---------- New Lead ---------- */
export function NewLeadDialog({ trigger, defaultStage }: { trigger: ReactNode; defaultStage?: LeadStage }) {
  const { addLead, users } = useStore();
  const { user } = useRole();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [budget, setBudget] = useState("5000000");
  const [source, setSource] = useState<LeadSource>("manual");
  const [stage, setStage] = useState<LeadStage>(defaultStage ?? "new");
  const [assignedTo, setAssignedTo] = useState(user.id);

  const submit = () => {
    if (!name.trim()) return toast.error("Name is required");
    addLead({
      name, email, phone, source, stage,
      score: 50, hot: false,
      budget: Number(budget) || 0,
      assignedTo,
      tenantId: user.tenantId,
      teamId: user.teamId,
    });
    toast.success(`Lead "${name}" created`);
    setOpen(false);
    setName(""); setEmail(""); setPhone(""); setBudget("5000000");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>Capture a prospect and assign an owner.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Full name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ahmed Mostafa" className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+20 10..." className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Budget (EGP)</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="mt-1" /></div>
            <div>
              <Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={v => setSource(v as LeadSource)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["widget","manual","referral","facebook","google","import"] as LeadSource[]).map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Stage</Label>
              <Select value={stage} onValueChange={v => setStage(v as LeadStage)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PIPELINE_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Assign to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{users.filter(u => u.role !== "super_admin").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-brand text-primary-foreground">Create lead</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Log Activity (call/email/whatsapp/note) ---------- */
export function LogActivityDialog({ trigger, leadId, type, title }: {
  trigger: ReactNode; leadId: string; type: "call" | "email" | "whatsapp" | "note"; title: string;
}) {
  const { logActivity } = useStore();
  const { user } = useRole();
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");

  const submit = () => {
    logActivity(leadId, type, title, user.id, desc.trim() || undefined);
    toast.success(`${title} logged`);
    setOpen(false);
    setDesc("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Add details to log this activity on the lead's timeline.</DialogDescription>
        </DialogHeader>
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What happened? Add notes…" rows={4} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-brand text-primary-foreground">Log</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- New Task ---------- */
export function NewTaskDialog({ trigger, leadId }: { trigger: ReactNode; leadId?: string }) {
  const { addTask, leads, users } = useStore();
  const { user } = useRole();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueAt, setDueAt] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [linkedLead, setLinkedLead] = useState(leadId ?? "none");
  const [assignedTo, setAssignedTo] = useState(user.id);

  const submit = () => {
    if (!title.trim()) return toast.error("Title required");
    addTask({
      title,
      leadId: linkedLead === "none" ? undefined : linkedLead,
      assignedTo,
      priority,
      status: "open",
      dueAt: new Date(dueAt).toISOString(),
    });
    toast.success("Task created");
    setOpen(false);
    setTitle("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Set a follow-up to keep momentum.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Follow up on viewing" className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Due date</Label><Input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} className="mt-1" /></div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {!leadId && (
            <div>
              <Label className="text-xs">Linked lead (optional)</Label>
              <Select value={linkedLead} onValueChange={setLinkedLead}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {leads.slice(0, 30).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Assign to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{users.filter(u => u.role !== "super_admin").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-brand text-primary-foreground">Create task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Schedule Visit ---------- */
export function ScheduleVisitDialog({ trigger, leadId }: { trigger: ReactNode; leadId?: string }) {
  const { addAppointment, leads, properties } = useStore();
  const { user } = useRole();
  const [open, setOpen] = useState(false);
  const [chosenLead, setChosenLead] = useState(leadId ?? "");
  const [propertyId, setPropertyId] = useState("");
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [location, setLocation] = useState("");

  const submit = () => {
    if (!chosenLead) return toast.error("Pick a lead");
    const lead = leads.find(l => l.id === chosenLead);
    addAppointment({
      title: `Site visit — ${lead?.name ?? "lead"}`,
      leadId: chosenLead,
      propertyId: propertyId || undefined,
      assignedTo: user.id,
      status: "scheduled",
      scheduledAt: new Date(`${date}T${time}:00`).toISOString(),
      durationMin: Number(duration),
      location: location || properties.find(p => p.id === propertyId)?.location,
    });
    toast.success("Visit scheduled");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule visit</DialogTitle>
          <DialogDescription>Book a property viewing or meeting.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {!leadId && (
            <div>
              <Label className="text-xs">Lead</Label>
              <Select value={chosenLead} onValueChange={setChosenLead}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{leads.slice(0, 30).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Property</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Time</Label><Input type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Duration (m)</Label><Input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="mt-1" /></div>
          </div>
          <div><Label className="text-xs">Location</Label><Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Auto from property" className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-brand text-primary-foreground">Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- New Property ---------- */
export function NewPropertyDialog({ trigger }: { trigger: ReactNode }) {
  const { addProperty } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PropertyType>("apartment");
  const [status, setStatus] = useState<PropertyStatus>("available");
  const [price, setPrice] = useState("5000000");
  const [bedrooms, setBedrooms] = useState("3");
  const [bathrooms, setBathrooms] = useState("2");
  const [area, setArea] = useState("150");
  const [location, setLocation] = useState("New Cairo");
  const [developer, setDeveloper] = useState("");

  const submit = () => {
    if (!title.trim()) return toast.error("Title required");
    addProperty({
      title, type, status,
      price: Number(price), bedrooms: Number(bedrooms), bathrooms: Number(bathrooms), area: Number(area),
      location, developer: developer || "Independent",
      image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80&auto=format&fit=crop",
    });
    toast.success("Property added");
    setOpen(false);
    setTitle("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add property</DialogTitle>
          <DialogDescription>Add a listing to your inventory.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Marina Bay Residence — 3BR" className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={v => setType(v as PropertyType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{(["apartment","villa","townhouse","office","land"] as PropertyType[]).map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as PropertyStatus)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{(["available","reserved","sold"] as PropertyStatus[]).map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><Label className="text-xs">Price</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Beds</Label><Input type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Baths</Label><Input type="number" value={bathrooms} onChange={e => setBathrooms(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Area m²</Label><Input type="number" value={area} onChange={e => setArea(e.target.value)} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Location</Label><Input value={location} onChange={e => setLocation(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Developer</Label><Input value={developer} onChange={e => setDeveloper(e.target.value)} className="mt-1" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-brand text-primary-foreground">Add property</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Invite Member ---------- */
export function InviteMemberDialog({ trigger }: { trigger: ReactNode }) {
  const { addUser } = useStore();
  const { user } = useRole();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"agent" | "manager">("agent");

  const submit = () => {
    if (!name || !email) return toast.error("Name and email required");
    addUser({ name, email, role, tenantId: user.tenantId, teamId: user.teamId });
    toast.success(`Invitation sent to ${email}`);
    setOpen(false);
    setName(""); setEmail("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>They'll receive an email to join your workspace.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Full name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" /></div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={v => setRole(v as any)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="manager">Manager / Leader</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-brand text-primary-foreground">Send invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Provision Tenant ---------- */
export function ProvisionTenantDialog({ trigger }: { trigger: ReactNode }) {
  const { addTenant } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<"starter" | "professional" | "enterprise">("professional");
  const [seats, setSeats] = useState("25");

  const submit = () => {
    if (!name.trim()) return toast.error("Name required");
    addTenant({ name, slug: slug || name.toLowerCase().replace(/[^a-z]+/g, "-"), plan, status: "active", seats: Number(seats) });
    toast.success(`Tenant "${name}" provisioned`);
    setOpen(false);
    setName(""); setSlug("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Provision tenant</DialogTitle>
          <DialogDescription>Create a new workspace on the platform.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Company name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Workspace slug</Label><Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="auto from name" className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Plan</Label>
              <Select value={plan} onValueChange={v => setPlan(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Seats</Label><Input type="number" value={seats} onChange={e => setSeats(e.target.value)} className="mt-1" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-brand text-primary-foreground">Provision</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Bulk Assign ---------- */
export function BulkAssignDialog({ trigger, ids, onDone }: { trigger: ReactNode; ids: string[]; onDone?: () => void }) {
  const { assignLeads, users } = useStore();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");

  const submit = () => {
    if (!userId) return;
    assignLeads(ids, userId);
    toast.success(`${ids.length} lead${ids.length > 1 ? "s" : ""} reassigned`);
    setOpen(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {ids.length} lead{ids.length > 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>Choose the new owner.</DialogDescription>
        </DialogHeader>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger><SelectValue placeholder="Pick a user…" /></SelectTrigger>
          <SelectContent>{users.filter(u => u.role !== "super_admin").map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-brand text-primary-foreground">Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Bulk Move Stage ---------- */
export function BulkStageDialog({ trigger, ids, onDone }: { trigger: ReactNode; ids: string[]; onDone?: () => void }) {
  const { bulkSetStage } = useStore();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<LeadStage>("contacted");

  const submit = () => {
    bulkSetStage(ids, stage);
    toast.success(`${ids.length} lead${ids.length > 1 ? "s" : ""} moved`);
    setOpen(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {ids.length} lead{ids.length > 1 ? "s" : ""} to stage</DialogTitle>
        </DialogHeader>
        <Select value={stage} onValueChange={v => setStage(v as LeadStage)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PIPELINE_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-brand text-primary-foreground">Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
