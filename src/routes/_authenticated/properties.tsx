import { createFileRoute } from "@tanstack/react-router";
import { Building2, MapPin, Plus } from "lucide-react";
import { PageHeader } from "@/components/crm/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProperties } from "@/hooks/use-supabase";
import { formatCurrency } from "@/lib/constants";
import { NewPropertyDialog } from "@/components/crm/dialogs";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({ meta: [{ title: "Properties — PropFlow CRM" }] }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const { profile } = useAuth();
  const { data: properties = [] } = useProperties({ tenant_id: profile?.tenant_id, limit: 100 });

  return (
    <div>
      <PageHeader
        title="Properties"
        description={`${(properties as any[]).length} listings in the catalog.`}
        actions={<NewPropertyDialog trigger={<Button size="sm" className="bg-gradient-brand text-primary-foreground"><Plus className="mr-1.5 h-4 w-4" /> Add property</Button>} />}
      />
      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {(properties as any[]).map(p => (
          <Card key={p.id} className="overflow-hidden shadow-card group">
            <img src={p.image ?? ""} alt={p.title} className="h-44 w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">{p.type}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${p.status === `available` ? `bg-success/15 text-success` : p.status === `reserved` ? `bg-warning/15 text-warning-foreground` : `bg-destructive/10 text-destructive`}`}>{p.status}</span>
              </div>
              <h3 className="mt-2 text-sm font-semibold line-clamp-2">{p.title}</h3>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.location}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {p.developer}</span>
              </div>
              {p.bedrooms > 0 && (
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  <span>{p.bedrooms} bed</span><span>·</span><span>{p.bathrooms} bath</span><span>·</span><span>{p.area}m²</span>
                </div>
              )}
              <p className="mt-3 text-lg font-bold text-primary">{formatCurrency(Number(p.price))}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
