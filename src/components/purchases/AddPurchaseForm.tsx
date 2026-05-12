import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { FileUploadZone, UploadedFile } from "./FileUploadZone";
import { DuplicateWarningModal } from "./DuplicateWarningModal";
import { CATEGORIES, Category } from "../ui/category-badge";

export function AddPurchaseForm({
  onSuccess,
  onCancel,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const create = useMutation(api.purchases.createPurchase);
  const [submitting, setSubmitting] = useState(false);
  const [showDup, setShowDup] = useState(false);
  const [dupId, setDupId] = useState<number | null>(null);

  const [products, setProducts] = useState("");
  const [amount, setAmount] = useState("");
  const [platform, setPlatform] = useState("");
  const [bank, setBank] = useState("");
  const [upi, setUpi] = useState("");
  const [category, setCategory] = useState<Category>("Other");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const today = new Date().toISOString().slice(0, 10);

  const submit = async (force = false) => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!products.trim() || !platform.trim() || !bank.trim() || !upi.trim()) {
      toast.error("All required fields must be filled");
      return;
    }
    const dateTs = new Date(date + "T00:00:00.000Z").getTime();
    if (dateTs > Date.now()) {
      toast.error("Date of purchase cannot be in the future");
      return;
    }

    setSubmitting(true);
    try {
      const res = await create({
        products_purchased: products,
        amount_spent: amountNum,
        purchase_platform: platform,
        bank_used_to_pay: bank,
        upi_app_used_to_pay: upi,
        category,
        date_of_purchase: dateTs,
        bill_files: files.map((f) => ({
          storageId: f.storageId,
          fileName: f.fileName,
          fileType: f.fileType,
          fileSize: f.fileSize,
        })),
        forceSubmit: force,
      });
      if (res.isDuplicate && !force) {
        setDupId(res.matchingDisplayId ?? null);
        setShowDup(true);
      } else {
        toast.success("Purchase submitted");
        onSuccess?.();
      }
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="products">Products Purchased *</Label>
        <Input
          id="products"
          value={products}
          onChange={(e) => setProducts(e.target.value)}
          placeholder="e.g. Lunch at Cafe"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount ₹ *</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="font-mono"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Date of Purchase *</Label>
          <Input
            id="date"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="platform">Purchase Platform *</Label>
        <Input
          id="platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          placeholder="e.g. Blinkit, Amazon"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bank">Bank Used to Pay *</Label>
          <Input
            id="bank"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="e.g. Kotak, HDFC"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="upi">UPI App *</Label>
          <Input
            id="upi"
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder="e.g. Google Pay"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Category *</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Bill Files (optional)</Label>
        <FileUploadZone files={files} onChange={setFiles} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="amber" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Purchase"}
        </Button>
      </div>

      <DuplicateWarningModal
        open={showDup}
        onOpenChange={setShowDup}
        matchingDisplayId={dupId}
        onConfirm={() => {
          setShowDup(false);
          submit(true);
        }}
        onCancel={() => setShowDup(false)}
      />
    </form>
  );
}
