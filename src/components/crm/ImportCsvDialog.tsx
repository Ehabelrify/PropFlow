import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { useCreateLead } from "@/hooks/use-supabase";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface ImportCsvDialogProps {
  trigger: React.ReactNode;
}

export function ImportCsvDialog({ trigger }: ImportCsvDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);
  const [parsing, setParsing] = useState(false);
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
    setFile(f);
    setParsing(true);
    const text = await f.text();
    const rows = parseCsv(text);
    setPreview(rows.slice(0, 5));
    setParsing(false);
  };

  const handleImport = () => {
    if (!file) return;
    file.text().then(text => {
      const rows = parseCsv(text);
      let success = 0;
      let failed = 0;
      const promises = rows.map(row => {
        const name = row["name"] || row["full name"] || row["contact"];
        if (!name) return Promise.resolve(null);
        return createLead.mutateAsync({
          name,
          email: row["email"] || null,
          phone: row["phone"] || null,
          budget: row["budget"] ? Number(row["budget"]) || 0 : 0,
          source: (row["source"] as any) || "website",
          tenant_id: profile?.tenant_id ?? null,
          assigned_to: profile?.id ?? null,
        }).then(() => { success++; }).catch(() => { failed++; });
      });
      Promise.all(promises).then(() => {
        toast.success(`Imported ${success} leads${failed > 0 ? `, ${failed} failed` : ""}`);
        setOpen(false);
        setFile(null);
        setPreview([]);
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns: name, email, phone, budget, source.
            Only <strong>name</strong> is required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/50 cursor-pointer"
            onClick={() => fileRef.current?.click()}
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

          {createLead.isPending && (
            <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info/5 p-3 text-xs text-info">
              <AlertCircle className="h-4 w-4" /> Importing leads...
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-brand text-primary-foreground" disabled={!file || createLead.isPending} onClick={handleImport}>
              <Upload className="mr-1.5 h-4 w-4" /> Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
