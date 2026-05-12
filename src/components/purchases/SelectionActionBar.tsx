import { FileSpreadsheet, FileText, X } from "lucide-react";
import { Button } from "../ui/button";

export function SelectionActionBar({
  count,
  onExportExcel,
  onExportPdf,
  onClear,
  extraButton,
}: {
  count: number;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onClear: () => void;
  extraButton?: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="selection-bar">
      <span className="text-sm font-mono">{count} record{count === 1 ? "" : "s"} selected</span>
      <Button size="sm" variant="amber" onClick={onExportExcel}>
        <FileSpreadsheet className="h-4 w-4 mr-1" />
        Export Excel
      </Button>
      <Button size="sm" variant="amber" onClick={onExportPdf}>
        <FileText className="h-4 w-4 mr-1" />
        Export PDF
      </Button>
      {extraButton}
      <button
        onClick={onClear}
        className="p-1.5 rounded hover:bg-white/10"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
