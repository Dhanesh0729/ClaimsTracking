import { formatIST } from "./formatters";

export type AuditExportRow = {
  timestamp: number;
  action: string;
  purchase_id: string;
  display_id?: number;
  performed_by_name: string;
  performed_by_role: string;
  conflict_flag: boolean;
  changes: string;
};

function escape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function exportAuditCsv(rows: AuditExportRow[]) {
  const header = [
    "Timestamp",
    "Action",
    "Purchase#",
    "PerformedBy",
    "Role",
    "ConflictFlag",
    "Changes",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        formatIST(r.timestamp),
        r.action,
        r.display_id ? `#${r.display_id}` : r.purchase_id,
        r.performed_by_name,
        r.performed_by_role,
        r.conflict_flag ? "YES" : "no",
        r.changes,
      ]
        .map((x) => escape(String(x)))
        .join(","),
    );
  }
  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const date = new Date();
  const fileName = `${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, "0")}_${String(date.getDate()).padStart(2, "0")}_AuditLog_ClaimTrack.csv`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
