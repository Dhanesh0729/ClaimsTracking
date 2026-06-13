import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatIST,
  formatISTDate,
  formatNumberINR,
  buildExportFileName,
} from "./formatters";
import type { ExportRow } from "./exportExcel";

const STATUS_COLORS: Record<string, [number, number, number]> = {
  approved: [16, 185, 129],
  pending: [245, 158, 11],
  rejected: [239, 68, 68],
  reimbursed: [59, 130, 246],
};

export function exportToPdf({
  rows,
  userName,
  uniqueCode,
}: {
  rows: ExportRow[];
  userName: string;
  uniqueCode: string;
}) {
  if (!rows.length) return;

  const dates = rows.map((r) => r.date_of_purchase).sort((a, b) => a - b);
  const fileName = buildExportFileName(
    dates[0],
    dates[dates.length - 1],
    userName,
    "pdf",
  );

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const totalApproved = rows
    .filter((r) => r.status === "approved" || r.status === "reimbursed")
    .reduce((s, r) => s + r.amount_spent, 0);
  const approvedCount = rows.filter((r) => r.status === "approved").length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const rejectedCount = rows.filter((r) => r.status === "rejected").length;
  const totalSum = rows.reduce((s, r) => s + r.amount_spent, 0);

  const drawHeaderFooter = (data: any) => {
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("ClaimTrack", 40, 30);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("Purchase Reimbursement Report", pageWidth - 40, 30, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(40, 38, pageWidth - 40, 38);

    const totalPages = (doc.internal as any).getNumberOfPages?.() ?? data.pageCount;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `ClaimTrack - Confidential | Page ${data.pageNumber} of ${totalPages} | Generated ${formatISTDate(Date.now())}`,
      pageWidth / 2,
      pageHeight - 15,
      { align: "center" },
    );

    doc.saveGraphicsState();
    (doc as any).setGState?.(new (doc as any).GState({ opacity: 0.15 }));
    doc.setFontSize(48);
    doc.setTextColor(226, 232, 240);
    doc.setFont("helvetica", "bold");
    doc.text("CLAIMTRACK", pageWidth / 2, pageHeight / 2, {
      angle: 45,
      align: "center",
    });
    doc.restoreGraphicsState();
  };

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(`Name: ${userName}`, 40, 60);
  doc.text(`Unique Code: ${uniqueCode}`, 280, 60);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Period: ${formatISTDate(dates[0])} to ${formatISTDate(dates[dates.length - 1])}`,
    40,
    78,
  );
  doc.text(`Generated: ${formatIST(Date.now())}`, 280, 78);

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(40, 92, pageWidth - 80, 36, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Total: ${rows.length} records   |   INR ${formatNumberINR(totalSum)}   |   Approved: ${approvedCount}   Pending: ${pendingCount}   Rejected: ${rejectedCount}   |   Approved INR: ${formatNumberINR(totalApproved)}`,
    pageWidth / 2,
    115,
    { align: "center" },
  );

  const body = rows.map((r, idx) => [
    idx + 1,
    r.products_purchased,
    formatNumberINR(r.amount_spent),
    r.purchase_platform,
    r.category,
    formatISTDate(r.date_of_purchase),
    r.status.toUpperCase(),
    r.bill_files.length
      ? r.bill_files.map((f) => f.fileName).join("\n")
      : "No Bill",
  ]);

  autoTable(doc, {
    head: [
      ["#", "Product", "Amount (INR)", "Platform", "Category", "Date", "Status", "Files"],
    ],
    body,
    startY: 140,
    margin: { top: 50, bottom: 30, left: 40, right: 40 },
    styles: { fontSize: 9, cellPadding: 5, valign: "middle" },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], halign: "left" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28 },
      2: { halign: "right", font: "courier" },
      5: { font: "courier", cellWidth: 70 },
      6: { halign: "center", fontStyle: "bold", cellWidth: 70 },
      7: { cellWidth: 100, fontSize: 7 },
    },
    didParseCell: (data) => {
      if (data.column.index === 6 && data.section === "body") {
        const status = (data.cell.raw as string).toLowerCase();
        const color = STATUS_COLORS[status];
        if (color) {
          data.cell.styles.textColor = color;
        }
      }
    },
    didDrawPage: drawHeaderFooter,
  });

  doc.save(fileName);
}
