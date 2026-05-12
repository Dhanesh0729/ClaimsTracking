import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { ExternalLink, ArrowLeft, Clock, FileText } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/ui/category-badge";
import {
  formatINR,
  formatIST,
  formatISTDate,
  buildBillRef,
  bytesToSize,
} from "@/lib/formatters";
import { SkeletonCard } from "@/components/ui/skeleton";

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const purchase = useQuery(
    api.purchases.getById,
    id ? { purchaseId: id as Id<"purchases"> } : "skip",
  );
  const auditTrail = useQuery(
    api.auditLog.listByPurchase,
    id ? { purchaseId: id as Id<"purchases"> } : "skip",
  );

  if (purchase === undefined) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (!purchase) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Purchase not found
      </div>
    );
  }

  const billRef = buildBillRef(
    purchase.bill_received_time,
    purchase.owner?.name ?? "USER",
    purchase.display_id,
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <Button variant="ghost" onClick={() => nav(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-3">
                Purchase #{purchase.display_id}
                <StatusBadge
                  status={purchase.status}
                  note={purchase.status_note}
                />
              </CardTitle>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {billRef}
              </p>
            </div>
            <CategoryBadge category={purchase.category} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Field label="Product" value={purchase.products_purchased} />
            <Field label="Amount" value={formatINR(purchase.amount_spent)} mono />
            <Field label="Platform" value={purchase.purchase_platform} />
            <Field label="Bank" value={purchase.bank_used_to_pay} />
            <Field label="UPI App" value={purchase.upi_app_used_to_pay} />
            <Field
              label="Date of Purchase"
              value={formatISTDate(purchase.date_of_purchase)}
              mono
            />
            <Field
              label="Submitted On"
              value={formatIST(purchase.bill_received_time)}
              mono
            />
            {purchase.scheduled_deletion_date && (
              <Field
                label="Scheduled Deletion"
                value={formatISTDate(purchase.scheduled_deletion_date)}
                mono
              />
            )}
          </div>
          {purchase.status_note && (
            <div className="mt-4 rounded border bg-secondary/50 p-3">
              <div className="text-xs font-semibold mb-1">Reviewer Note</div>
              <div className="text-sm">{purchase.status_note}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Bill Files ({purchase.bill_files.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchase.bill_files.length === 0 ? (
            <div className="text-sm text-muted-foreground">No files attached</div>
          ) : (
            <div className="space-y-2">
              {purchase.bill_files.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded border"
                >
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{f.fileName}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {bytesToSize(f.fileSize)}
                    </div>
                  </div>
                  {f.convexUrl && (
                    <a
                      href={f.convexUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-info hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!auditTrail || auditTrail.length === 0 ? (
            <div className="text-sm text-muted-foreground">No audit entries</div>
          ) : (
            <ol className="relative border-l-2 border-border space-y-3 pl-4">
              {auditTrail.map((a) => (
                <li key={a._id} className="text-sm">
                  <div className="absolute -left-[5px] mt-1 h-2 w-2 rounded-full bg-navy" />
                  <div className="font-mono text-xs text-muted-foreground">
                    {formatIST(a.timestamp)}
                  </div>
                  <div className="font-medium text-xs">
                    {a.action.toUpperCase()} by {a.performed_by_name}{" "}
                    <span className="text-muted-foreground">({a.performed_by_role})</span>
                    {a.conflict_flag && (
                      <span className="ml-2 text-amber font-bold">⚠ CONFLICT</span>
                    )}
                  </div>
                  <pre className="mt-1 text-[10px] font-mono bg-secondary/50 p-2 rounded overflow-x-auto">
                    {a.changes}
                  </pre>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value}</div>
    </div>
  );
}
