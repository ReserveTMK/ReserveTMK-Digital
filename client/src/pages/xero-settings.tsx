import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, XCircle, ExternalLink, Loader2, Unplug } from "lucide-react";

interface XeroStatus {
  connected: boolean;
  hasCredentials: boolean;
  organisationName: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  accountCode: string;
  taxType: string;
}

export default function XeroSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [accountCode, setAccountCode] = useState("");
  const [taxType, setTaxType] = useState("");

  const { data: status, isLoading } = useQuery<XeroStatus>({
    queryKey: ["/api/xero/status"],
    refetchOnWindowFocus: true,
  });

  // Sync local state when data loads
  const currentAccountCode = accountCode || status?.accountCode || "200";
  const currentTaxType = taxType || status?.taxType || "OUTPUT2";

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/xero/connect");
      const data = await res.json();
      return data.authUrl;
    },
    onSuccess: (authUrl: string) => {
      window.location.href = authUrl;
    },
    onError: (err: any) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/xero/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/status"] });
      toast({ title: "Xero disconnected" });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async (data: { accountCode: string; taxType: string }) => {
      await apiRequest("POST", "/api/xero/update-account-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/status"] });
      toast({ title: "Account settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-16 max-w-2xl flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Xero Integration</h1>
        <p className="text-muted-foreground mt-1">Connect to Xero for automated invoicing and bookkeeping.</p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection</CardTitle>
          <CardDescription>
            {status?.connected
              ? `Connected to ${status.organisationName || "Xero"}`
              : "Not connected to Xero"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {status?.connected ? (
              <>
                <Badge variant="default" className="bg-green-600 gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </Badge>
                {status.organisationName && (
                  <span className="text-sm text-muted-foreground">{status.organisationName}</span>
                )}
              </>
            ) : (
              <Badge variant="secondary" className="gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Not connected
              </Badge>
            )}
          </div>

          {status?.connectedAt && (
            <p className="text-xs text-muted-foreground">
              Connected {new Date(status.connectedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}

          <div className="flex gap-2">
            {status?.connected ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Unplug className="w-4 h-4 mr-1.5" />
                )}
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !status?.hasCredentials}
              >
                {connectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                )}
                Connect to Xero
              </Button>
            )}
          </div>

          {!status?.hasCredentials && (
            <p className="text-sm text-amber-600">
              No API credentials found. Add your Xero Client ID and Secret in the developer portal, then contact your admin.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Account Settings */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoice Defaults</CardTitle>
            <CardDescription>Default account code and tax type for generated invoices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountCode">Account Code</Label>
                <Input
                  id="accountCode"
                  value={currentAccountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  placeholder="200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxType">Tax Type</Label>
                <Input
                  id="taxType"
                  value={currentTaxType}
                  onChange={(e) => setTaxType(e.target.value)}
                  placeholder="OUTPUT2"
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => updateAccountMutation.mutate({ accountCode: currentAccountCode, taxType: currentTaxType })}
              disabled={updateAccountMutation.isPending}
            >
              {updateAccountMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
