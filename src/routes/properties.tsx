import { createFileRoute } from "@tanstack/react-router";
import { Plus, MapPin, Bed, Bath, Maximize2 } from "lucide-react";
import { useStore } from "@/lib/data-store";
import { formatCurrency } from "@/lib/mock-data";
import { PageHeader } from "@/components/crm/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NewPropertyDialog } from "@/components/crm/dialogs";

export const Route = createFileRoute("/properties")({
  head: () => ({ meta: [{ title: "Properties — PropFlow CRM" }, { name: "description", content: "Manage your real estate inventory." }] }),
  component: PropertiesPage,
});

const statusTone: Record<string, string> = {
  available: "bg-success/15 text-success",
  reserved: "bg-warning/20 text-warning-foreground",
  sold: "bg-muted text-muted-foreground",
};

function PropertiesPage() {
  const { properties } = useStore();
  return (
    <div>
      <PageHeader title="Properties" description={`${properties.length} listings in your inventory.`} actions={<NewPropertyDialog trigger={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> Add Property</Button>} />} />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map(p => (
          <Card key={p.id} className="overflow-hidden shadow-card transition hover:shadow-elevated">
            <div className="relative h-44 w-full overflow-hidden bg-muted">
              <img src={p.image} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
              <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase backdrop-blur ${statusTone[p.status]}`}>{p.status}</span>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{p.developer} · {p.type}</p>
              <h3 className="mt-1 line-clamp-1 text-sm font-semibold">{p.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {p.location}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                {p.bedrooms > 0 && <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {p.bedrooms}</span>}
                <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms}</span>
                <span className="flex items-center gap-1"><Maximize2 className="h-3.5 w-3.5" /> {p.area}m²</span>
              </div>
              <p className="mt-3 text-base font-bold text-primary">{formatCurrency(p.price)}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
