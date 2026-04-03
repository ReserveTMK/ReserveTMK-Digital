import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Link2, Unlink } from "lucide-react";

export function XeroSettingsTab() {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accountCode, setAccountCode] = useState("200");
  const [taxType, setTaxType] = useState("OUTPUT2");

  const { data: xeroStatus, isLoading } = useQuery<{
    connected: boolean;
    hasCredentials: boolean;
    organisationName: string | null;
    connectedAt: string | null;
    tokenExpiresAt: string | null;
    accountCode: string;
    taxType: string;
  }>({
    queryKey: ['/api/xero/status'],
  });

  useEffect(() => {
    if (xeroStatus) {
      setAccountCode(xeroStatus.accountCode || "200");
      setTaxType(xeroStatus.taxType || "OUTPUT2");
    }
  }, [xeroStatus]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/save-credentials", {
        xeroClientId: clientId,
        xeroClientSecret: clientSecret,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xero/status'] });
      toast({ title: "Credentials saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const saveAccountSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/update-account-settings", {
        accountCode,
        taxType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xero/status'] });
      toast({ title: "Account settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save account settings", description: err.message, variant: "destructive" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!xeroStatus?.hasCredentials) {
        await apiRequest("POST", "/api/xero/save-credentials", {
          xeroClientId: clientId,
          xeroClientSecret: clientSecret,
        });
      }
      const res = await apiRequest("GET", "/api/xero/connect");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (err: any) => {
      toast({ title: "Failed to connect", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/disconnect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xero/status'] });
      toast({ title: "Xero disconnected" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to disconnect", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (xeroStatus?.connected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <Link2 className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="font-medium text-green-800 dark:text-green-200" data-testid="text-xero-org-name">
              Connected to {xeroStatus.organisationName || "Xero"}
            </p>
            {xeroStatus.connectedAt && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Connected {new Date(xeroStatus.connectedAt).toLocaleDateString("en-NZ")}
              </p>
            )}
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200" data-testid="badge-xero-connected">Connected</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Invoices will be automatically generated in Xero when venue hires are accepted. Venue hires with koha, package credits, or zero amounts are skipped.
        </p>
        <div className="p-3 rounded-lg border bg-muted/50 space-y-3">
          <p className="text-sm font-medium">Invoice defaults</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Account Code</label>
              <Input
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                placeholder="200"
                data-testid="input-xero-account-code"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Tax Type</label>
              <Input
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
                placeholder="OUTPUT2"
                data-testid="input-xero-tax-type"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => saveAccountSettingsMutation.mutate()}
            disabled={saveAccountSettingsMutation.isPending || (accountCode === (xeroStatus?.accountCode || "200") && taxType === (xeroStatus?.taxType || "OUTPUT2"))}
            data-testid="button-xero-save-account-settings"
          >
            {saveAccountSettingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Invoice Defaults
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => disconnectMutation.mutate()}
          disabled={disconnectMutation.isPending}
          data-testid="button-xero-disconnect"
        >
          {disconnectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
          Disconnect Xero
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect to Xero to automatically generate invoices when venue hires are confirmed. You'll need to create a Xero app first.
      </p>
      <div className="p-3 rounded-lg border bg-muted/50 text-sm space-y-2">
        <p className="font-medium">Setup instructions:</p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Go to <a href="https://developer.xero.com/app/manage" target="_blank" rel="noopener noreferrer" className="text-primary underline">developer.xero.com</a> and create a new app</li>
          <li>Set the app type to "Web app"</li>
          <li>Add the redirect URI: <code className="text-xs bg-background px-1 py-0.5 rounded">{window.location.origin}/api/xero/callback</code></li>
          <li>Copy the Client ID and Client Secret below</li>
        </ol>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Client ID</label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter your Xero Client ID"
            data-testid="input-xero-client-id"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Client Secret</label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Enter your Xero Client Secret"
            data-testid="input-xero-client-secret"
          />
        </div>
      </div>
      <Button
        onClick={() => connectMutation.mutate()}
        disabled={(!clientId || !clientSecret) && !xeroStatus?.hasCredentials || connectMutation.isPending}
        data-testid="button-xero-connect"
      >
        {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
        Save & Connect to Xero
      </Button>
    </div>
  );
}
