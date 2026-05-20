import { useEffect, useState } from "react";
import { AlertTriangle, Users, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

interface DuplicateLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  stage: string;
  created_at: string;
  match_type: string;
  confidence: number;
}

interface DuplicateLeadWarningProps {
  email: string;
  phone?: string;
  tenantId: string;
  excludeLeadId?: string;
  onMerge?: (keepLeadId: string, mergeLeadId: string) => void;
}

export function DuplicateLeadWarning({
  email,
  phone,
  tenantId,
  excludeLeadId,
  onMerge,
}: DuplicateLeadWarningProps) {
  const [duplicates, setDuplicates] = useState<DuplicateLead[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email || !tenantId) return;

    const checkDuplicates = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("find_duplicate_leads", {
          p_email: email,
          p_phone: phone || undefined,
          p_tenant_id: tenantId,
          p_exclude_lead_id: excludeLeadId || undefined,
        });

        if (error) {
          console.error("Error checking duplicates:", error);
          return;
        }

        // Filter to only show high-confidence matches
        const highConfidenceMatches = (data || []).filter(
          (d: DuplicateLead) => d.confidence >= 70
        );
        setDuplicates(highConfidenceMatches);
      } catch (err) {
        console.error("Error checking duplicates:", err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the check
    const timer = setTimeout(checkDuplicates, 500);
    return () => clearTimeout(timer);
  }, [email, phone, tenantId, excludeLeadId]);

  if (loading || duplicates.length === 0) {
    return null;
  }

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case "email_exact":
        return "Exact email match";
      case "phone_exact":
        return "Exact phone match";
      case "email_similar":
        return "Similar email";
      default:
        return "Potential match";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return "destructive";
    if (confidence >= 80) return "default";
    return "secondary";
  };

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        Potential Duplicate Lead{duplicates.length > 1 ? "s" : ""} Found
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm">
          {duplicates.length === 1
            ? "A lead with similar information already exists:"
            : `${duplicates.length} leads with similar information already exist:`}
        </p>

        <div className="space-y-2">
          {duplicates.map((duplicate) => (
            <div
              key={duplicate.id}
              className="flex items-center justify-between rounded-md border border-border bg-background p-3"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {duplicate.name}
                  </span>
                  <Badge variant={getConfidenceColor(duplicate.confidence)}>
                    {duplicate.confidence}% match
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {getMatchTypeLabel(duplicate.match_type)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{duplicate.email}</span>
                  {duplicate.phone && <span>• {duplicate.phone}</span>}
                  <span>• Stage: {duplicate.stage}</span>
                  <span>
                    • Created{" "}
                    {formatDistanceToNow(new Date(duplicate.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link to="/leads/$leadId" params={{ leadId: duplicate.id }}>
                  <Button variant="outline" size="sm" className="gap-1">
                    View Lead
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
                {onMerge && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMerge(duplicate.id, excludeLeadId || "")}
                    className="text-xs"
                  >
                    Merge
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          💡 <strong>Tip:</strong> Check if this is the same person before
          creating a new lead. Duplicates can cause confusion and data
          inconsistencies.
        </p>
      </AlertDescription>
    </Alert>
  );
}

// Made with Bob
