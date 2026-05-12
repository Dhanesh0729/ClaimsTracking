import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

export function DuplicateWarningModal({
  open,
  onOpenChange,
  matchingDisplayId,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matchingDisplayId: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber" />
            Possible Duplicate Detected
          </DialogTitle>
          <DialogDescription>
            This looks like a duplicate of Purchase #{matchingDisplayId} submitted today. Submit anyway?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="amber" onClick={onConfirm}>
            Yes, Submit Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
