import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateTenant } from "@/hooks/use-supabase";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  seats: number;
  status: string;
}

interface EditTenantDialogProps {
  tenant: Tenant;
  trigger: React.ReactNode;
}

export function EditTenantDialog({ tenant, trigger }: EditTenantDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tenant.name);
  const [slug, setSlug] = useState(tenant.slug);
  const [plan, setPlan] = useState(tenant.plan);
  const [seats, setSeats] = useState(String(tenant.seats));
  const [status, setStatus] = useState(tenant.status);
  const updateTenant = useUpdateTenant();

  useEffect(() => {
    if (open) {
      setName(tenant.name);
      setSlug(tenant.slug);
      setPlan(tenant.plan);
      setSeats(String(tenant.seats));
      setStatus(tenant.status);
    }
  }, [open, tenant]);

  const handleSave = () => {
    updateTenant.mutate({
      id: tenant.id,
      name: name.trim(),
      slug: slug.trim(),
      plan,
      seats: parseInt(seats, 10) || 1,
      status,
    }, {
      onSuccess: () => {
        toast.success("Tenant updated");
        setOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit tenant</DialogTitle>
          <DialogDescription>Update tenant details, plan, and status.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div>
            <Label className="text-xs">Company name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Slug</Label>
            <Input value={slug} onChange={e => setSlug(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Seats</Label>
            <Input type="number" min={1} value={seats} onChange={e => setSeats(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="bg-gradient-brand text-primary-foreground" disabled={updateTenant.isPending} onClick={handleSave}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
