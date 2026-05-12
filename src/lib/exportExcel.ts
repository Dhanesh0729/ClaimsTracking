import * as XLSX from "xlsx-js-style";
import {
  formatIST,
  formatINR,
  buildExportFileName,
} from "./formatters";

type FileSummary = {
  storageId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  convexUrl: string;
};

export type ExportRow = {
  display_id: number;
  products_purchased: string;
  amount_spent: number;
  purchase_platform: string;
  bank_used_to_pay: string;
  upi_app_used_to_pay: string;
  category: string;
  date_of_purchase: number;
  bill_received_time: number;
  status: string;
  bill_files: FileSummary[];
};

function fileLinkLabel(fileName: string, idx: number): string {
  const lower = fileName.toLowerCase();
  if (lower.match(/\.(png|jpe?g)$/)) {
    const ext = lower.split(".").pop() ?? "img";
    return `View Image ${idx}.${ext}`;
  }
  if (lower.endsWith(".pdf")) return `View PDF ${idx}.pdf`;
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
    const ext = lower.split(".").pop() ?? "doc";
    return `View Doc ${idx}.${ext}`;
  }
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) {
    const ext = lower.split(".").pop() ?? "xls";
    return `View Excel ${idx}.${ext}`;
  }
  if (lower.endsWith(".csv")) return `View CSV ${idx}.csv`;
  return `View File ${idx}`;
}

export function exportToExcel({
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
    "xlsx",
  );

  const headerRow = [
    "Id",
    "Products_Purchased",
    "Amount_Spent",
    "Purchase_Platform",
    "Bank_UsedToPay",
    "UPI_AppUsedToPay",
    "Category",
    "DateofPurchase",
    "Bill_Received_Time",
    "Status",
    "Bill_Files",
  ];

  const data: any[][] = [headerRow];

  rows.forEach((r) => {
    let filesCell: any = "No Bill";
    if (r.bill_files && r.bill_files.length > 0) {
      const parts = r.bill_files.map((f, idx) => {
        const label = fileLinkLabel(f.fileName, idx + 1);
        return { f: `HYPERLINK("${f.convexUrl}","${label}")`, t: "f", label };
      });
      if (parts.length === 1) {
        filesCell = { f: parts[0].f, t: "f" } as any;
      } else {
        filesCell = parts.map((p) => p.label).join("\n");
      }
    }
    data.push([
      r.display_id,
      r.products_purchased,
      r.amount_spent,
      r.purchase_platform,
      r.bank_used_to_pay,
      r.upi_app_used_to_pay,
      r.category,
      new Date(r.date_of_purchase),
      new Date(r.bill_received_time),
      r.status,
      filesCell,
    ]);
  });

  const sumRow = ["", "SUM", { f: `SUM(C2:C${rows.length + 1})` }, "", "", "", "", "", "", "", ""];
  data.push(sumRow as any);

  const ws = XLSX.utils.aoa_to_sheet(data);

  const numCols = headerRow.length;
  const lastRow = data.length;

  ws["!cols"] = headerRow.map((h, idx) => {
    const widths = data.map((row) => {
      const cell = row[idx];
      if (cell == null) return 8;
      if (typeof cell === "object" && cell.f) return Math.min(40, cell.f.length / 2 + 5);
      if (cell instanceof Date) return 22;
      return Math.min(40, String(cell).length + 2);
    });
    return { wch: Math.max(h.length + 2, Math.max(...widths)) };
  });

  ws["!freeze"] = { xSplit: "0", ySplit: "1" } as any;
  if (!ws["!frozen"]) (ws as any)["!frozen"] = { ySplit: 1 };

  for (let R = 0; R < lastRow; R++) {
    for (let C = 0; C < numCols; C++) {
      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[ref];
      if (!cell) continue;
      cell.s = cell.s ?? {};
      if (R === 0) {
        cell.s = {
          ...cell.s,
          fill: { fgColor: { rgb: "0F172A" } },
          font: { color: { rgb: "FFFFFF" }, bold: true },
          alignment: { vertical: "center", horizontal: "center" },
        };
      } else {
        const stripe = R % 2 === 0 ? "F8FAFC" : "FFFFFF";
        cell.s = {
          ...cell.s,
          fill: { fgColor: { rgb: stripe } },
          alignment: {
            vertical: "center",
            wrapText: C === numCols - 1,
          },
        };
      }
      if (C === 2 && R > 0 && R < lastRow - 1) {
        cell.z = '"₹"#,##,##0.00';
        cell.s.alignment = { ...cell.s.alignment, horizontal: "right" };
      }
      if (C === 2 && R === lastRow - 1) {
        cell.z = '"₹"#,##,##0.00';
        cell.s = {
          ...cell.s,
          font: { bold: true },
          fill: { fgColor: { rgb: "E2E8F0" } },
        };
      }
      if ((C === 7 || C === 8) && R > 0 && R < lastRow - 1) {
        cell.z = "dd-mm-yyyy hh:mm";
      }
    }
  }

  const ws2Data: any[][] = [
    ["User Name", userName, "", "Unique Code", uniqueCode],
    [
      "Period",
      `${new Date(dates[0]).toLocaleDateString("en-GB")} → ${new Date(dates[dates.length - 1]).toLocaleDateString("en-GB")}`,
      "",
      "Generated",
      formatIST(Date.now()),
    ],
    [],
    ["Category Breakdown"],
    ["Category", "Count", "Total ₹"],
  ];

  const categoryAgg = new Map<string, { c: number; t: number }>();
  rows.forEach((r) => {
    const m = categoryAgg.get(r.category) ?? { c: 0, t: 0 };
    m.c++;
    m.t += r.amount_spent;
    categoryAgg.set(r.category, m);
  });
  for (const [cat, v] of categoryAgg) {
    ws2Data.push([cat, v.c, v.t]);
  }
  ws2Data.push([], ["Status Breakdown"], ["Status", "Count", "Total ₹"]);
  const statusAgg = new Map<string, { c: number; t: number }>();
  rows.forEach((r) => {
    const m = statusAgg.get(r.status) ?? { c: 0, t: 0 };
    m.c++;
    m.t += r.amount_spent;
    statusAgg.set(r.status, m);
  });
  for (const [s, v] of statusAgg) {
    ws2Data.push([s, v.c, v.t]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  ws2["!cols"] = [{ wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
  void formatINR;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Purchases");
  XLSX.utils.book_append_sheet(wb, ws2, "Summary");
  XLSX.writeFile(wb, fileName, { cellStyles: true });
}
