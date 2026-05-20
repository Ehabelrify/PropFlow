import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, FileText, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useCreateLead } from "@/hooks/use-supabase";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { validateCSVData, sanitizeCSVRow } from "@/lib/csv-validation";

interface ImportCsvDialogProps {
  trigger: React.ReactNode;
}

const CONCURRENCY_LIMIT = 5;

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  const results: Array<{ success: boolean; result?: T; error?: Error }> = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      const task = tasks[currentIndex];
      try {
        const result = await task();
        results[currentIndex] = { success: true, result };
      } catch (error) {
        results[currentIndex] = { success: false, error: error as Error };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export function ImportCsvDialog({ trigger }: ImportCsvDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);
  const [parsing, setParsing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const createLead = useCreateLead();
  const { profile } = useAuth();

  const parseCsv = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      toast.error("CSV must have a header row and at least one data row");
      return [];
    }
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => obj[h] = vals[i] ?? "");
      return obj;
    });
    return rows;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".csv")) {
      toast.error("Only CSV files are supported");
      return;
    }
    if (f.size > 1024 * 1024) {
      toast.error("File size must be under 1MB");
      return;
    }
    setFile(f);
    setParsing(true);
    setImportProgress(null);
    const text = await f.text();
    const rows = parseCsv(text);

    const validation = validateCSVData(rows as any);
    if (!validation.valid) {
      toast.error(`CSV validation failed: ${validation.errors[0]?.error}`);
      setParsing(false);
      return;
    }

    if (rows.length > 500) {
      toast.error("Max 500 rows per import");
      setParsing(false);
      return;
    }

    setPreview(rows.slice(0, 5));
    setParsing(false);
    if (validation.warnings.length > 0) {
      toast.warning(`${validation.warnings.length} warnings found — review before importing`);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    const sanitizedRows = rows.map(r => sanitizeCSVRow(r as any));

    setImportProgress({ current: 0, total: sanitizedRows.length, success: 0, failed: 0 });

    const tasks: Array<() => Promise<{ success: boolean }>> = sanitizedRows.map(row => {
      const name = row.name || row["full name"] || row["contact"];
      if (!name) return async () => ({ success: false });
      return async () => {
        await createLead.mutateAsync({
          name,
          email: row.email || null,
          phone: row.phone || null,
          budget: row.budget ? Number(row.budget) || 0 : 0,
          source: (row.source as any) || "import",
          stage: (row.stage as any) || "new",
          tenant_id: profile?.tenant_id ?? null,
          team_id: profile?.team_id ?? null,
          assigned_to: profile?.id ?? null,
          tags: [],
        });
        return { success: true };
      };
    });

    const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);

    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    setImportProgress({ current: sanitizedRows.length, total: sanitizedRows.length, success, failed });

    if (failed > 0) {
      toast.error(`Imported ${success} leads, ${failed} failed`);
    } else {
      toast.success(`Successfully imported ${success} leads`);
    }

    if (failed === 0) {
      setTimeout(() => {
        setOpen(false);
        setFile(null);
        setPreview([]);
        setImportProgress(null);
      }, 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setFile(null); setPreview([]); setImportProgress(null); } setOpen(o); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns: name, email, phone, budget, source, stage.
            Only <strong>name</strong> is required. Max 500 rows.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/50 cursor-pointer"
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
            aria-label="Upload CSV file"
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            {file ? (
              <>
                <FileText className="h-8 w-8 text-primary" />
                <p className="mt-2 text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{preview.length}+ rows detected</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Click to upload CSV</p>
                <p className="text-xs text-muted-foreground">Max 500 rows per import</p>
              </>
            )}
          </div>

          {preview.length > 0 && (
            <div>
              <Label className="text-xs">Preview (first 5 rows)</Label>
              <div className="mt-1 overflow-x-auto rounded-md border text-xs">
                <table className="w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      {Object.keys(preview[0]).map(k => (
                        <th key={k} className="px-2 py-1.5 text-left font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-2 py-1.5 text-muted-foreground">{v || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importProgress && (
            <div className={`flex items-center gap-2 rounded-md border p-3 text-xs ${
              importProgress.failed > 0
                ? "border-warning/30 bg-warning/5 text-warning"
                : "border-success/30 bg-success/5 text-success"
            }`}>
              {importProgress.failed > 0 ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {importProgress.current < importProgress.total
                ? `Importing... ${importProgress.current}/${importProgress.total}`
                : `Done: ${importProgress.success} succeeded, ${importProgress.failed} failed`
              }
            </div>
          )}

          {createLead.isPending && !importProgress && (
            <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info/5 p-3 text-xs text-info">
              <AlertCircle className="h-4 w-4" /> Preparing import...
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-brand text-primary-foreground" disabled={!file || createLead.isPending || !!importProgress} onClick={handleImport}>
              <Upload className="mr-1.5 h-4 w-4" /> Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
