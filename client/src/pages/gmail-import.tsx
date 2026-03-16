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
  Eye,
  Link2,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";

interface CleanupContact {
  id: number;
  name: string;
  email: string;
  notes: string | null;
}

interface GmailStatus {
  connected: boolean;
  syncSettings: {
    autoSyncEnabled: boolean;
    syncIntervalHours: number;
    minEmailFrequency: number;
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
  previewData?: PreviewData | null;
}

interface PreviewPerson {
  email: string;
  name: string;
  domain: string;
  frequency: number;
  recentSubjects: string[];
  latestEmailDate: string | null;
  isDuplicate?: boolean;
  existingContactId?: number;
  existingContactEmail?: string;
}

interface PreviewOrg {
  domain: string;
  suggestedName: string;
  aiName?: string;
  frequency: number;
  memberEmails: string[];
  existingGroupId?: number;
  unmatchedExistingContacts?: Array<{ id: number; name: string; email: string }>;
}

interface PreviewData {
  people: PreviewPerson[];
  orgs: PreviewOrg[];
  existingContactEmails?: Array<{
    email: string;
    name: string;
    contactId: number;
    recentSubjects: string[];
    latestEmailDate: string | null;
  }>;
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
  const [selectedCleanup, setSelectedCleanup] = useState<Set<number>>(new Set());
  const [location] = useLocation();

  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
  const [previewHistoryId, setPreviewHistoryId] = useState<number | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [duplicateActions, setDuplicateActions] = useState<Record<string, 'skip' | 'create' | 'merge'>>({});

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
    if (!pollingQuery.data) return;
    const { status } = pollingQuery.data;

    if (status === 'preview') {
      setPollingId(null);
      setPreviewHistoryId(pollingQuery.data.id);
      if (pollingQuery.data.previewData) {
        const preview = pollingQuery.data.previewData;
        setSelectedPeople(new Set(preview.people.filter(p => !p.isDuplicate).map(p => p.email)));
        setSelectedOrgs(new Set(preview.orgs.map(o => o.domain)));
        const defaultActions: Record<string, 'skip' | 'create' | 'merge'> = {};
        preview.people.filter(p => p.isDuplicate).forEach(p => {
          defaultActions[p.email] = 'skip';
        });
        setDuplicateActions(defaultActions);
      }
      toast({ title: "Scan Complete", description: "Review the results below before importing." });
    } else if (status === 'completed') {
      setPollingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/history"] });
      toast({
        title: "Import Complete",
        description: `Created ${pollingQuery.data.contactsCreated} contacts and ${pollingQuery.data.groupsCreated} organisations`,
      });
    } else if (status === 'error') {
      setPollingId(null);
      toast({
        title: "Import Failed",
        description: pollingQuery.data.errorMessage || "An error occurred",
        variant: "destructive",
      });
    }
  }, [pollingQuery.data?.status]);

  const scanMutation = useMutation({
    mutationFn: async (params: { daysBack: number; scanType: string; accountIds?: number[] }) => {
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

  const confirmMutation = useMutation({
    mutationFn: async (params: {
      historyId: number;
      selectedEmails: string[];
      selectedDomains: string[];
      duplicateActions: Record<string, 'skip' | 'create' | 'merge'>;
      linkExistingContacts: boolean;
    }) => {
      const res = await apiRequest("POST", "/api/gmail/import/confirm", params);
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewHistoryId(null);
      setSelectedPeople(new Set());
      setSelectedOrgs(new Set());
      setDuplicateActions({});
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/history"] });
      toast({
        title: "Import Complete",
        description: `Created ${data.contactsCreated} contacts, ${data.groupsCreated} organisations, ${data.interactionsCreated} interactions${data.contactsLinked > 0 ? `, linked ${data.contactsLinked} existing contacts` : ''}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Import Failed",
        description: err.message || "Could not complete import",
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

  const updateFrequencyMutation = useMutation({
    mutationFn: async (minEmailFrequency: number) => {
      const res = await apiRequest("PUT", "/api/gmail/sync-settings", { minEmailFrequency });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
      toast({ title: "Frequency threshold updated" });
    },
  });

  const cleanupQuery = useQuery<CleanupContact[]>({
    queryKey: ["/api/gmail/cleanup-suggestions"],
  });

  const cleanupMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const res = await apiRequest("POST", "/api/gmail/cleanup", { contactIds });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/cleanup-suggestions"] });
      setSelectedCleanup(new Set());
      toast({ title: "Cleanup Complete", description: `Removed ${data.deleted} contacts` });
    },
    onError: (err: any) => {
      toast({ title: "Cleanup Failed", description: err.message, variant: "destructive" });
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

  const previewQuery = useQuery<ImportHistoryItem>({
    queryKey: ["/api/gmail/history", previewHistoryId],
    enabled: !!previewHistoryId && !pollingId,
  });
  const previewData = previewHistoryId
    ? (previewQuery.data?.previewData || pollingQuery.data?.previewData || null)
    : null;

  useEffect(() => {
    if (accounts.length > 0) {
      setSelectedAccountIds(prev => {
        const validIds = new Set(accounts.map(a => a.id));
        const next = new Set<number>();
        for (const id of prev) {
          if (validIds.has(id)) next.add(id);
        }
        if (next.size === 0) {
          return validIds;
        }
        return next;
      });
    }
  }, [accounts]);

  const handleScan = (daysBack: number, scanType: string) => {
    const ids = accounts.length > 0 ? Array.from(selectedAccountIds) : undefined;
    scanMutation.mutate({ daysBack, scanType, accountIds: ids });
  };

  const handleScanSingleAccount = (accountId: number) => {
    scanMutation.mutate({ daysBack: 365, scanType: 'manual', accountIds: [accountId] });
  };

  const toggleAccountSelection = (id: number) => {
    const next = new Set(selectedAccountIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedAccountIds(next);
  };

  if (statusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (previewData) {
    return (
      <div className="space-y-6" data-testid="gmail-preview-page">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setPreviewHistoryId(null); setSelectedPeople(new Set()); setSelectedOrgs(new Set()); }}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-back-from-preview"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-preview-title">Review Import</h1>
            <p className="text-muted-foreground text-sm">
              Review discovered contacts and organisations before importing
            </p>
          </div>
        </div>

        <Card data-testid="card-preview-people">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  People ({previewData.people.length})
                </CardTitle>
                <CardDescription>
                  {selectedPeople.size} selected for import
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPeople(new Set(previewData.people.map(p => p.email)))}
                  data-testid="button-select-all-people"
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPeople(new Set())}
                  data-testid="button-deselect-all-people"
                >
                  Deselect All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {previewData.people.map((person) => (
                <div
                  key={person.email}
                  className={`flex items-start gap-3 py-3 px-4 rounded-lg border ${person.isDuplicate ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                  data-testid={`preview-person-${person.email}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPeople.has(person.email)}
                    onChange={() => {
                      const next = new Set(selectedPeople);
                      if (next.has(person.email)) next.delete(person.email);
                      else next.add(person.email);
                      setSelectedPeople(next);
                    }}
                    className="mt-1 rounded"
                    data-testid={`checkbox-person-${person.email}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{person.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {person.frequency} email{person.frequency !== 1 ? 's' : ''}
                      </Badge>
                      {person.isDuplicate && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Possible Duplicate
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{person.email}</p>

                    {person.isDuplicate && (
                      <div className="mt-2 p-2 rounded bg-amber-100/50 dark:bg-amber-900/30 text-xs">
                        <p className="text-amber-800 dark:text-amber-200">
                          Existing contact "{person.name}" has email: {person.existingContactEmail}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant={duplicateActions[person.email] === 'skip' ? 'default' : 'outline'}
                            className="h-6 text-xs px-2"
                            onClick={() => setDuplicateActions(prev => ({ ...prev, [person.email]: 'skip' }))}
                            data-testid={`button-dup-skip-${person.email}`}
                          >
                            Skip
                          </Button>
                          <Button
                            size="sm"
                            variant={duplicateActions[person.email] === 'create' ? 'default' : 'outline'}
                            className="h-6 text-xs px-2"
                            onClick={() => {
                              setDuplicateActions(prev => ({ ...prev, [person.email]: 'create' }));
                              setSelectedPeople(prev => new Set([...prev, person.email]));
                            }}
                            data-testid={`button-dup-create-${person.email}`}
                          >
                            Create Anyway
                          </Button>
                          <Button
                            size="sm"
                            variant={duplicateActions[person.email] === 'merge' ? 'default' : 'outline'}
                            className="h-6 text-xs px-2"
                            onClick={() => {
                              setDuplicateActions(prev => ({ ...prev, [person.email]: 'merge' }));
                              setSelectedPeople(prev => new Set([...prev, person.email]));
                            }}
                            data-testid={`button-dup-merge-${person.email}`}
                          >
                            Merge
                          </Button>
                        </div>
                      </div>
                    )}

                    {person.recentSubjects.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Recent emails:</p>
                        {person.recentSubjects.map((subj, i) => (
                          <p key={i} className="text-xs text-muted-foreground truncate pl-2 border-l-2 border-muted">
                            {subj}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {previewData.people.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No new contacts found</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-preview-orgs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organisations ({previewData.orgs.length})
                </CardTitle>
                <CardDescription>
                  {selectedOrgs.size} selected for import
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedOrgs(new Set(previewData.orgs.map(o => o.domain)))}
                  data-testid="button-select-all-orgs"
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedOrgs(new Set())}
                  data-testid="button-deselect-all-orgs"
                >
                  Deselect All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {previewData.orgs.map((org) => (
                <div
                  key={org.domain}
                  className="flex items-start gap-3 py-3 px-4 rounded-lg border"
                  data-testid={`preview-org-${org.domain}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedOrgs.has(org.domain)}
                    onChange={() => {
                      const next = new Set(selectedOrgs);
                      if (next.has(org.domain)) next.delete(org.domain);
                      else next.add(org.domain);
                      setSelectedOrgs(next);
                    }}
                    className="mt-1 rounded"
                    data-testid={`checkbox-org-${org.domain}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{org.aiName || org.suggestedName}</span>
                      {org.existingGroupId && (
                        <Badge variant="secondary" className="text-xs">Existing</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {org.memberEmails.length} member{org.memberEmails.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{org.domain}</p>

                    {org.unmatchedExistingContacts && org.unmatchedExistingContacts.length > 0 && (
                      <div className="mt-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 text-xs">
                        <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300 mb-1">
                          <Link2 className="h-3 w-3" />
                          <span>{org.unmatchedExistingContacts.length} existing contact{org.unmatchedExistingContacts.length !== 1 ? 's' : ''} can be linked:</span>
                        </div>
                        {org.unmatchedExistingContacts.map(c => (
                          <p key={c.id} className="text-blue-600 dark:text-blue-400 pl-2">
                            {c.name} ({c.email})
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {previewData.orgs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No new organisations found</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => { setPreviewHistoryId(null); setSelectedPeople(new Set()); setSelectedOrgs(new Set()); }}
            data-testid="button-cancel-import"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (previewHistoryId) {
                confirmMutation.mutate({
                  historyId: previewHistoryId,
                  selectedEmails: Array.from(selectedPeople),
                  selectedDomains: Array.from(selectedOrgs),
                  duplicateActions,
                  linkExistingContacts: true,
                });
              }
            }}
            disabled={confirmMutation.isPending || (selectedPeople.size === 0 && selectedOrgs.size === 0 && (!previewData?.existingContactEmails || previewData.existingContactEmails.length === 0))}
            data-testid="button-confirm-import"
          >
            {confirmMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirm Import ({selectedPeople.size} people, {selectedOrgs.size} orgs)
          </Button>
        </div>
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
                <input
                  type="checkbox"
                  checked={selectedAccountIds.has(account.id)}
                  onChange={() => toggleAccountSelection(account.id)}
                  className="rounded"
                  data-testid={`checkbox-account-${account.id}`}
                />
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleScanSingleAccount(account.id)}
                  disabled={isScanning || !account.hasValidToken}
                  data-testid={`button-scan-account-${account.id}`}
                >
                  {isScanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
                  Scan
                </Button>
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
                ? "Run a new scan to discover new contacts since your last import"
                : "Run your initial scan to discover contacts from the past 12 months of emails"}
              {accounts.length > 1 && ` (${selectedAccountIds.size} of ${accounts.length} accounts selected)`}
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
                  onClick={() => handleScan(365, 'initial')}
                  disabled={isScanning || (accounts.length > 0 && selectedAccountIds.size === 0)}
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
                    onClick={() => handleScan(30, 'manual')}
                    disabled={isScanning || (accounts.length > 0 && selectedAccountIds.size === 0)}
                    data-testid="button-scan-30d"
                  >
                    {isScanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Scan Last 30 Days
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleScan(90, 'manual')}
                    disabled={isScanning || (accounts.length > 0 && selectedAccountIds.size === 0)}
                    data-testid="button-scan-90d"
                  >
                    Last 90 Days
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleScan(365, 'manual')}
                    disabled={isScanning || (accounts.length > 0 && selectedAccountIds.size === 0)}
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
          <CardContent className="space-y-6">
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
            <div className="border-t pt-4">
              <div className="space-y-2">
                <Label>Minimum email frequency</Label>
                <p className="text-sm text-muted-foreground">
                  Only create contacts from people you have exchanged this many emails with. Higher values filter out more one-off senders.
                </p>
                <Select
                  value={String(status?.syncSettings?.minEmailFrequency ?? 2)}
                  onValueChange={(val) => updateFrequencyMutation.mutate(parseInt(val))}
                >
                  <SelectTrigger className="w-[120px]" data-testid="select-min-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 email</SelectItem>
                    <SelectItem value="2">2 emails</SelectItem>
                    <SelectItem value="3">3 emails</SelectItem>
                    <SelectItem value="5">5 emails</SelectItem>
                    <SelectItem value="10">10 emails</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

      {(cleanupQuery.data?.length ?? 0) > 0 && (
        <Card data-testid="card-cleanup">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Cleanup Suggestions
            </CardTitle>
            <CardDescription>
              These contacts were imported from a single email and look like marketing or automated senders. Review and remove any that are not real people.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {cleanupQuery.data!.length} suspect contact{cleanupQuery.data!.length !== 1 ? 's' : ''} found
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedCleanup.size === cleanupQuery.data!.length) {
                      setSelectedCleanup(new Set());
                    } else {
                      setSelectedCleanup(new Set(cleanupQuery.data!.map(c => c.id)));
                    }
                  }}
                  data-testid="button-toggle-select-all"
                >
                  {selectedCleanup.size === cleanupQuery.data!.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => cleanupMutation.mutate(Array.from(selectedCleanup))}
                  disabled={selectedCleanup.size === 0 || cleanupMutation.isPending}
                  data-testid="button-delete-selected"
                >
                  {cleanupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Delete Selected ({selectedCleanup.size})
                </Button>
              </div>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {cleanupQuery.data!.map((contact) => (
                <label
                  key={contact.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer"
                  data-testid={`cleanup-item-${contact.id}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCleanup.has(contact.id)}
                    onChange={(e) => {
                      const next = new Set(selectedCleanup);
                      if (e.target.checked) next.add(contact.id);
                      else next.delete(contact.id);
                      setSelectedCleanup(next);
                    }}
                    className="rounded"
                    data-testid={`checkbox-cleanup-${contact.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{contact.email}</p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                    {item.status === 'preview' && <Eye className="h-5 w-5 text-amber-500 shrink-0" />}
                    {item.status === 'error' && <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {item.scanType === 'initial' ? 'Initial Import' : item.scanType === 'sync' ? 'Auto-Sync' : 'Manual Scan'}
                        </span>
                        <Badge variant={item.status === 'completed' ? 'default' : item.status === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                          {item.status === 'preview' ? 'Awaiting Review' : item.status}
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

                  <div className="flex items-center gap-3">
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
                    {item.status === 'preview' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPreviewHistoryId(item.id);
                          setPollingId(item.id);
                        }}
                        data-testid={`button-review-${item.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Review
                      </Button>
                    )}
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
