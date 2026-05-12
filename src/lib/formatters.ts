const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatIST(timestamp: number): string {
  const d = new Date(timestamp + IST_OFFSET_MS);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTH_ABBREV[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hour = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${year} ${hour}:${min} IST`;
}

export function formatISTDate(timestamp: number): string {
  const d = new Date(timestamp + IST_OFFSET_MS);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTH_ABBREV[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${mon} ${year}`;
}

export function formatINR(amount: number): string {
  const fixed = amount.toFixed(2);
  const [whole, dec] = fixed.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  if (digits.length <= 3) {
    return `${negative ? "-" : ""}₹${digits}.${dec}`;
  }
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const restFormatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}₹${restFormatted},${last3}.${dec}`;
}

export function formatNumberINR(amount: number): string {
  return formatINR(amount).replace("₹", "");
}

export function buildBillRef(
  billReceivedTime: number,
  userName: string,
  displayId: number,
): string {
  const d = new Date(billReceivedTime + IST_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const cleanName = userName.toUpperCase().replace(/\s+/g, "_");
  const billNum = "BILL" + String(displayId).padStart(4, "0");
  return `${year}_${month}_${cleanName}_${billNum}`;
}

export function buildExportFileName(
  rangeStart: number,
  rangeEnd: number,
  userName: string,
  ext: "xlsx" | "pdf" | "csv",
): string {
  const start = new Date(rangeStart + IST_OFFSET_MS);
  const end = new Date(rangeEnd + IST_OFFSET_MS);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();
  const cleanName = userName.replace(/\s+/g, "_");
  if (sameMonth) {
    const y = start.getUTCFullYear();
    const m = String(start.getUTCMonth() + 1).padStart(2, "0");
    return `${y}_${m}_PurchaseReport_${cleanName}.${ext}`;
  }
  const sy = start.getUTCFullYear();
  const sm = String(start.getUTCMonth() + 1).padStart(2, "0");
  const sd = String(start.getUTCDate()).padStart(2, "0");
  const ey = end.getUTCFullYear();
  const em = String(end.getUTCMonth() + 1).padStart(2, "0");
  const ed = String(end.getUTCDate()).padStart(2, "0");
  return `${sy}_${sm}_${sd}_to_${ey}_${em}_${ed}_PurchaseReport_${cleanName}.${ext}`;
}

export function fileExtFromName(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

export function bytesToSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
