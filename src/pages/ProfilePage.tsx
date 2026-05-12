import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { SkeletonCard } from "@/components/ui/skeleton";
import { formatIST } from "@/lib/formatters";

export function ProfilePage() {
  const me = useQuery(api.users.getMe);
  const myRequest = useQuery(api.roleRequests.getMyRequest);
  const submitRequest = useMutation(api.roleRequests.submitRequest);
  const updateProfile = useMutation(api.users.updateProfile);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  if (!me) return <SkeletonCard />;

  const startEdit = () => {
    setName(me.name);
    setMobile(me.mobile);
    setEditing(true);
  };

  const save = async () => {
    try {
      await updateProfile({ name: name.trim(), mobile: mobile.trim() });
      toast.success("Profile updated");
      setEditing(false);
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const requestPromotion = async () => {
    try {
      const targetRole = me.role === "user" ? "master" : "admin";
      await submitRequest({ requestedRole: targetRole });
      toast.success("Request submitted");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const hasPending = myRequest && myRequest.status === "pending";
  const canRequest = me.role === "user" || me.role === "master";

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Personal details and role information
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{me.name}</CardTitle>
              <CardDescription>{me.email}</CardDescription>
            </div>
            <RoleBadge role={me.role} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unique Code" value={me.unique_code} mono />
            <Field label="Joined On" value={formatIST(me.created_at)} mono />
          </div>

          {!editing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile" value={me.mobile} />
                <Field label="Email" value={me.email} />
              </div>
              <Button size="sm" variant="outline" onClick={startEdit}>
                Edit profile
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile</Label>
                <Input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={save}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {canRequest && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Role Promotion</CardTitle>
            <CardDescription>
              Request a higher role. Only one request can be pending at a time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasPending ? (
              <Button disabled>Request Pending...</Button>
            ) : myRequest && myRequest.status === "rejected" ? (
              <div className="space-y-2">
                <div className="text-sm text-danger">
                  Last request rejected{" "}
                  {myRequest.decided_at && `(${formatIST(myRequest.decided_at)})`}
                </div>
                {myRequest.decision_note && (
                  <div className="text-xs p-2 rounded bg-secondary">
                    Note: {myRequest.decision_note}
                  </div>
                )}
                <Button onClick={requestPromotion}>
                  Request {me.role === "user" ? "Master" : "Admin"} role
                </Button>
              </div>
            ) : (
              <Button onClick={requestPromotion}>
                Request {me.role === "user" ? "Master" : "Admin"} role
              </Button>
            )}
            {myRequest && myRequest.status === "approved" && (
              <div className="text-sm text-success mt-2">
                Last request was approved.
              </div>
            )}
          </CardContent>
        </Card>
      )}
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
