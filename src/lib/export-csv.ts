import type { Lead } from "./types";

export function exportLeadsCsv(leads: Lead[], filename = "leads.csv") {
  const headers = ["id", "name", "email", "phone", "stage", "source", "score", "budget", "assignedTo", "createdAt"];
  const rows = leads.map(l => headers.map(h => {
    const v = (l as any)[h];
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
