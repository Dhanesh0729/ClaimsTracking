import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OnboardingPage() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) {
      toast.error("Both fields are required");
      return;
    }
    setSubmitting(true);
    try {
      await completeOnboarding({ name: name.trim(), mobile: mobile.trim() });
      toast.success("Welcome to ClaimTrack");
      nav("/dashboard", { replace: true });
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy text-white p-4">
      <Card className="w-full max-w-md text-foreground">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded bg-amber flex items-center justify-center">
              <Wallet className="h-4 w-4 text-navy" />
            </div>
            <span className="font-bold">ClaimTrack</span>
          </div>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>
            We need a few details to set up your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dhanesh Suyambu"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input
                id="mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91 9XXXXXXXXX"
                required
              />
            </div>
            <Button
              type="submit"
              variant="amber"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Setting up..." : "Continue to Dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
