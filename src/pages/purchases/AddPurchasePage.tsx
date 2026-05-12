import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AddPurchaseForm } from "@/components/purchases/AddPurchaseForm";
import { useEffect, useState } from "react";

export function AddPurchasePage() {
  const nav = useNavigate();
  const [open, setOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const close = () => {
    setOpen(false);
    setTimeout(() => nav("/purchases"), 200);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="w-full sm:max-w-[540px]">
        <SheetHeader className="mb-4">
          <SheetTitle>Add Purchase</SheetTitle>
        </SheetHeader>
        <AddPurchaseForm onSuccess={close} onCancel={close} />
      </SheetContent>
    </Sheet>
  );
}
