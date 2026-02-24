import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/beautiful-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  Building2,
  Clock,
  Trash2,
  Plus,
  AlertCircle,
  ArrowLeft,
  History,
  Ban,
  Zap,
  UserPlus,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";

interface GmailStatus {
  connected: boolean;
  syncSettings: {
    autoSyncEnabled: boolean;
    syncIntervalHours: number;
    lastSyncAt: string | null;
  } | null;
  latestImport: ImportHistoryItem | null;
  totalImports: number;
  additionalAccountsCount: number;
}

interface ImportHistoryItem {
  id: number;
  scanType: string;
  emailsScanned: number;
  contactsCreated: number;
  groupsCreated: number;
  contactsSkipped: number;
  groupsSkipped: number;
  status: string;
  errorMessage: string | null;
  scanFromDate: string | null;
  scanToDate: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface GmailExclusion {
  id: number;
  type: string;
  value: string;
  createdAt: string;
}

interface ConnectedAccount {
  id: number;
  email: string;
  label: string | null;
  createdAt: string;
  tokenExpiry: string | null;
  hasValidToken: boolean;
}

interface OAuthConfig {
  configured: boolean;
}

export default function GmailImportPage() {
  const { toast } = useToast();
  const [exclusionType, setExclusionType] = useState<string>("domain");
  const [exclusionValue, setExclusionValue] = useState("");
  const [pollingId, setPollingId] = useState<number | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'account_added') {
      toast({ title: "Gmail Account Connected", description: "Your additional Gmail account has been linked." });
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      window.history.replaceState({}, '', '/gmail-import');
    } else if (params.get('error')) {
      const errorMsg = params.get('error') === 'auth_failed' ? 'Authentication failed. Please try again.'
        : params.get('error') === 'not_configured' ? 'Google OAuth is not configured.'
        : 'An error occurred during authentication.';
      toast({ title: "Connection Failed", description: errorMsg, variant: "destructive" });
      window.history.replaceState({}, '', '/gmail-import');
    }
  }, []);

  const statusQuery = useQuery<GmailStatus>({
    queryKey: ["/api/gmail/status"],
  });

  const historyQuery = useQuery<ImportHistoryItem[]>({
    queryKey: ["/api/gmail/history"],
  });

  const exclusionsQuery = useQuery<GmailExclusion[]>({
    queryKey: ["/api/gmail/exclusions"],
  });

  const accountsQuery = useQuery<ConnectedAccount[]>({
    queryKey: ["/api/gmail/accounts"],
  });

  const oauthConfigQuery = useQuery<OAuthConfig>({
    queryKey: ["/api/gmail/oauth/config"],
  });

  const pollingQuery = useQuery<ImportHistoryItem>({
    queryKey: ["/api/gmail/history", pollingId],
    enabled: !!pollingId,
    refetchInterval: pollingId ? 3000 : false,
  });

  useEffect(() => {
    if (pollingQuery.data?.status === 'completed' || pollingQuery.data?.status === 'error') {
      setPollingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/history"] });
      if (pollingQuery.data.status === 'completed') {
        toast({
          title: "Import Complete",
          description: `Created ${pollingQuery.data.contactsCreated} contacts and ${pollingQuery.data.groupsCreated} organisations`,
        });
      } else {
        toast({
          title: "Import Failed",
          description: pollingQuery.data.errorMessage || "An error occurred",
          variant: "destructive",
        });
      }
    }
  }, [pollingQuery.data?.status]);

  const scanMutation = useMutation({
    mutationFn: async (params: { daysBack: number; scanType: string; accountId?: number }) => {
      const res = await apiRequest("POST", "/api/gmail/scan", params);
      return res.json();
    },
    onSuccess: (data) => {
      setPollingId(data.historyId);
      toast({ title: "Scan Started", description: "Scanning your emails in the background..." });
    },
    onError: (err: any) => {
      toast({
        title: "Scan Failed",
        description: err.message || "Could not start the scan",
        variant: "destructive",
      });
    },
  });

  const toggleSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PUT", "/api/gmail/sync-settings", { autoSyncEnabled: enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/sync-settings"] });
    },
  });

  const addExclusionMutation = useMutation({
    mutationFn: async (data: { type: string; value: string }) => {
      const res = await apiRequest("POST", "/api/gmail/exclusions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/exclusions"] });
      setExclusionValue("");
      toast({ title: "Exclusion Added" });
    },
  });

  const deleteExclusionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/gmail/exclusions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/exclusions"] });
    },
  });

  const addAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/gmail/oauth/authorize");
      const data = await res.json();
      window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({
        title: "Cannot Add Account",
        description: err.message || "Google OAuth is not configured",
        variant: "destructive",
      });
    },
  });

  const removeAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/gmail/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      toast({ title: "Account Removed" });
    },
  });

  const isScanning = !!pollingId || scanMutation.isPending;
  const status = statusQuery.data;
  const history = historyQuery.data || [];
  const exclusions = exclusionsQuery.data || [];
  const accounts = accountsQuery.data || [];
  const oauthConfigured = oauthConfigQuery.data?.configured ?? false;
  const hasAnyConnection = status?.connected || accounts.length > 0;
  const hasInitialImport = history.some(h => h.status === 'completed');

  if (statusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="gmail-import-page">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Gmail Import</h1>
          <p className="text-muted-foreground text-sm">Import contacts and organisations from your email</p>
        </div>
      </div>

      {!hasAnyConnection && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              No Gmail accounts connected. Connect your primary Gmail via the platform integration, or add accounts below.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-connection-status">
          <CardContent className="p-4 flex items-center gap-3">
            {hasAnyConnection ? (
              <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-8 w-8 text-red-400 shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">Accounts</p>
              <p className="text-lg font-bold" data-testid="text-connection-status">
                {(status?.connected ? 1 : 0) + accounts.length} Connected
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-imports">
          <CardContent className="p-4 flex items-center gap-3">
            <History className="h-8 w-8 text-indigo-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Total Imports</p>
              <p className="text-lg font-bold" data-testid="text-total-imports">
                {status?.totalImports || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-last-sync">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-purple-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Last Sync</p>
              <p className="text-lg font-bold" data-testid="text-last-sync">
                {status?.syncSettings?.lastSyncAt
                  ? new Date(status.syncSettings.lastSyncAt).toLocaleDateString("en-NZ", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Never"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-connected-accounts">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Connected Gmail Accounts
              </CardTitle>
              <CardDescription>
                Manage your connected Gmail accounts for contact import
              </CardDescription>
            </div>
            {oauthConfigured && (
              <Button
                size="sm"
                onClick={() => addAccountMutation.mutate()}
                disabled={addAccountMutation.isPending}
                data-testid="button-add-account"
              >
                {addAccountMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Add Gmail Account
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {status?.connected && (
            <div className="flex items-center justify-between py-3 px-4 rounded-lg border bg-muted/30" data-testid="account-primary">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-indigo-500 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Primary Account</span>
                    <Badge variant="secondary" className="text-xs">Platform Connector</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Connected via platform integration</p>
                </div>
              </div>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
          )}

          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between py-3 px-4 rounded-lg border"
              data-testid={`account-item-${account.id}`}
            >
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-indigo-500 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{account.email}</span>
                    {!account.hasValidToken && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Token Expired
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(account.createdAt).toLocaleDateString("en-NZ", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAccountMutation.mutate(account.id)}
                disabled={removeAccountMutation.isPending}
                data-testid={`button-remove-account-${account.id}`}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {!status?.connected && accounts.length === 0 && (
            <div className="text-center py-6">
              <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No Gmail accounts connected yet</p>
              {oauthConfigured ? (
                <Button
                  size="sm"
                  onClick={() => addAccountMutation.mutate()}
                  disabled={addAccountMutation.isPending}
                  data-testid="button-add-first-account"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Connect Gmail Account
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Set up the platform Gmail integration or add Google OAuth credentials to connect accounts.
                </p>
              )}
            </div>
          )}

          {!oauthConfigured && (status?.connected || accounts.length > 0) && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>To add more Gmail accounts, configure Google OAuth credentials (GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET).</span>
            </div>
          )}
        </CardContent>
      </Card>

      {hasAnyConnection && (
        <Card data-testid="card-scan-controls">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Scan
            </CardTitle>
            <CardDescription>
              {hasInitialImport
                ? "Run a new scan to import any new contacts since your last import"
                : "Run your initial scan to import contacts from the past 12 months of emails"}
              {accounts.length > 0 && status?.connected && " (scans all connected accounts)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isScanning && (
              <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                <div>
                  <p className="font-medium text-indigo-900 dark:text-indigo-100">Scanning emails...</p>
                  {pollingQuery.data && (
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                      {pollingQuery.data.emailsScanned} emails scanned so far
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {!hasInitialImport ? (
                <Button
                  onClick={() => scanMutation.mutate({ daysBack: 365, scanType: 'initial' })}
                  disabled={isScanning}
                  data-testid="button-initial-scan"
                >
                  {isScanning ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Run Initial Import (12 months)
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => scanMutation.mutate({ daysBack: 30, scanType: 'manual' })}
                    disabled={isScanning}
                    data-testid="button-scan-30d"
                  >
                    {isScanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Scan Last 30 Days
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => scanMutation.mutate({ daysBack: 90, scanType: 'manual' })}
                    disabled={isScanning}
                    data-testid="button-scan-90d"
                  >
                    Last 90 Days
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => scanMutation.mutate({ daysBack: 365, scanType: 'manual' })}
                    disabled={isScanning}
                    data-testid="button-scan-365d"
                  >
                    Last 12 Months
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {hasAnyConnection && (
        <Card data-testid="card-auto-sync">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Daily Auto-Sync
            </CardTitle>
            <CardDescription>
              Automatically scan for new contacts from recent emails once a day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Daily Sync</Label>
                <p className="text-sm text-muted-foreground">
                  Runs once every 24 hours to pick up new email contacts
                </p>
              </div>
              <Switch
                checked={status?.syncSettings?.autoSyncEnabled ?? false}
                onCheckedChange={(checked) => toggleSyncMutation.mutate(checked)}
                data-testid="switch-auto-sync"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-exclusion-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5" />
            Exclusion List
          </CardTitle>
          <CardDescription>
            Domains and email addresses that will be skipped during import
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={exclusionType} onValueChange={setExclusionType}>
              <SelectTrigger className="w-[130px]" data-testid="select-exclusion-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="domain">Domain</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={exclusionType === 'domain' ? 'example.com' : 'user@example.com'}
              value={exclusionValue}
              onChange={(e) => setExclusionValue(e.target.value)}
              className="flex-1"
              data-testid="input-exclusion-value"
            />
            <Button
              size="sm"
              onClick={() => {
                if (exclusionValue.trim()) {
                  addExclusionMutation.mutate({ type: exclusionType, value: exclusionValue.trim() });
                }
              }}
              disabled={!exclusionValue.trim() || addExclusionMutation.isPending}
              data-testid="button-add-exclusion"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {exclusions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No exclusions configured</p>
          ) : (
            <div className="space-y-2">
              {exclusions.map((exc) => (
                <div
                  key={exc.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
                  data-testid={`exclusion-item-${exc.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {exc.type}
                    </Badge>
                    <span className="text-sm font-mono">{exc.value}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteExclusionMutation.mutate(exc.id)}
                    data-testid={`button-delete-exclusion-${exc.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-import-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Import History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No imports yet</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 px-4 rounded-lg border"
                  data-testid={`history-item-${item.id}`}
                >
                  <div className="flex items-center gap-3">
                    {item.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
                    {item.status === 'running' && <Loader2 className="h-5 w-5 animate-spin text-indigo-500 shrink-0" />}
                    {item.status === 'error' && <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {item.scanType === 'initial' ? 'Initial Import' : item.scanType === 'sync' ? 'Auto-Sync' : 'Manual Scan'}
                        </span>
                        <Badge variant={item.status === 'completed' ? 'default' : item.status === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("en-NZ", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {item.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">{item.errorMessage}</p>
                      )}
                    </div>
                  </div>

                  {item.status === 'completed' && (
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span>{item.emailsScanned}</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-600">
                        <Users className="h-3.5 w-3.5" />
                        <span>+{item.contactsCreated}</span>
                      </div>
                      <div className="flex items-center gap-1 text-blue-600">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>+{item.groupsCreated}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
