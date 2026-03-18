import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, Shield, Clock, XCircle, Trash2, RefreshCw, Loader2, ShieldAlert } from "lucide-react";
import type { AllowedUser } from "@shared/models/auth";

export default function TeamSettingsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const { data: allowedUsers = [], isLoading } = useQuery<AllowedUser[]>({
    queryKey: ["/api/admin/allowed-users"],
    enabled: isAdmin,
  });

  const addMutation = useMutation({
    mutationFn: async (emailVal: string) => {
      const res = await apiRequest("POST", "/api/admin/allowed-users", { email: emailVal });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allowed-users"] });
      setEmail("");
      toast({ title: "User invited", description: "They can now log in with their Replit account." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to invite", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/allowed-users/${id}/revoke`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allowed-users"] });
      toast({ title: "Access revoked" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/allowed-users/${id}/reactivate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allowed-users"] });
      toast({ title: "Access restored" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/allowed-users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allowed-users"] });
      toast({ title: "User removed" });
    },
  });

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-6 py-16 max-w-4xl text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2" data-testid="text-access-denied">Access Denied</h1>
        <p className="text-muted-foreground">Only administrators can manage team access.</p>
      </div>
    );
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    addMutation.mutate(email.trim());
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-600" data-testid="badge-status-active"><Shield className="w-3 h-3 mr-1" />Active</Badge>;
      case "pending":
        return <Badge variant="secondary" data-testid="badge-status-pending"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "revoked":
        return <Badge variant="destructive" data-testid="badge-status-revoked"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">Team</h1>
        <p className="text-muted-foreground mt-1">Manage who can access this platform. Only invited users can log in.</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invite User
          </CardTitle>
          <CardDescription>Add a user by their email address. They will be able to log in using their Replit account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-3" data-testid="form-invite-user">
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              data-testid="input-invite-email"
            />
            <Button type="submit" disabled={addMutation.isPending || !email.trim()} data-testid="button-invite">
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Invite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowed Users</CardTitle>
          <CardDescription>{allowedUsers.filter(u => u.status !== "revoked").length} active or pending, {allowedUsers.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : allowedUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No users invited yet. Add one above to get started.</p>
          ) : (
            <div className="space-y-3">
              {allowedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  data-testid={`row-allowed-user-${user.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium" data-testid={`text-email-${user.id}`}>{user.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Invited {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(user.status)}
                    {user.status === "revoked" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reactivateMutation.mutate(user.id)}
                        disabled={reactivateMutation.isPending}
                        data-testid={`button-reactivate-${user.id}`}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Restore
                      </Button>
                    )}
                    {user.status !== "revoked" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeMutation.mutate(user.id)}
                        disabled={revokeMutation.isPending}
                        data-testid={`button-revoke-${user.id}`}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Revoke
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Remove this user permanently?")) {
                          deleteMutation.mutate(user.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${user.id}`}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
