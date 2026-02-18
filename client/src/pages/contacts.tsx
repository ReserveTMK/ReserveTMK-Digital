import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/beautiful-button";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { Plus, Search, Filter, Loader2, User, Upload, FileUp, AlertCircle, CheckCircle2, X, MessageSquare, FileText, Users, TrendingUp, UserCheck, UserX } from "lucide-react";
import { useState, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContactSchema } from "@shared/schema";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ContactFormValues = Record<string, any>;

export default function Contacts() {
  const { data: contacts, isLoading } = useContacts();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const filteredContacts = contacts?.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(search.toLowerCase()) || 
                          contact.businessName?.toLowerCase().includes(search.toLowerCase()) ||
                          contact.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || contact.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const analytics = useMemo(() => {
    if (!contacts || contacts.length === 0) return null;
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    let active30 = 0;
    let active90 = 0;
    let totalInteractions = 0;
    let totalDebriefs = 0;
    const roleCounts: Record<string, number> = {};

    for (const c of contacts as any[]) {
      const parsed = c.lastInteractionDate ? new Date(c.lastInteractionDate).getTime() : 0;
      const lastDate = Number.isFinite(parsed) ? parsed : 0;
      if (lastDate >= thirtyDaysAgo) active30++;
      if (lastDate >= ninetyDaysAgo) active90++;
      totalInteractions += (c.interactionCount || 0) + (c.eventCount || 0);
      totalDebriefs += c.debriefCount || 0;
      const role = c.role || "Unknown";
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }

    const inactive = contacts.length - active90;
    const topRoles = Object.entries(roleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return { total: contacts.length, active30, active90, inactive, totalInteractions, totalDebriefs, topRoles };
  }, [contacts]);

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 pt-14 md:pt-0 pb-20 md:pb-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold">Community</h1>
              <p className="text-muted-foreground mt-1">Manage your mentees and network.</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setBulkOpen(true)} data-testid="button-bulk-upload">
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="shadow-lg" data-testid="button-add-member">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <CreateContactDialogContent onSuccess={() => setOpen(false)} />
              </Dialog>
            </div>
          </div>

          <BulkUploadDialog open={bulkOpen} onOpenChange={setBulkOpen} />

          {analytics && (
            <div className="space-y-3" data-testid="community-analytics">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-4" data-testid="stat-total-members">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold font-display leading-none">{analytics.total}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Total Members</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4" data-testid="stat-active-30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold font-display leading-none">{analytics.active30}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Active (30d)</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4" data-testid="stat-inactive">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <UserX className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold font-display leading-none">{analytics.inactive}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Inactive (90d+)</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4" data-testid="stat-total-interactions">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold font-display leading-none">{analytics.totalInteractions}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Interactions</p>
                    </div>
                  </div>
                </Card>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {analytics.topRoles.map(([role, count]) => (
                  <Badge key={role} variant="secondary" className="text-xs" data-testid={`stat-role-${role.toLowerCase().replace(/\s+/g, '-')}`}>
                    {role}: {count}
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground ml-1" data-testid="stat-total-debriefs">
                  {analytics.totalDebriefs} debrief{analytics.totalDebriefs !== 1 ? 's' : ''} logged
                </span>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or email..." 
                className="pl-10 h-11 bg-card rounded-xl border-border/60"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-contacts"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-card border-border/60" data-testid="select-role-filter">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Filter by Role" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="Entrepreneur">Entrepreneur</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Innovator">Innovator</SelectItem>
                  <SelectItem value="Want-trepreneur">Want-trepreneur</SelectItem>
                  <SelectItem value="Rangatahi">Rangatahi</SelectItem>
                  <SelectItem value="Business Owner">Business Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contacts List */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredContacts?.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No community members found</h3>
              <p className="text-muted-foreground mb-6">Try adjusting your filters or add a new member.</p>
              <Button onClick={() => setOpen(true)} variant="outline" data-testid="button-add-member-empty">Add Member</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {(filteredContacts || []).map((contact: any) => (
                <Link key={contact.id} href={`/contacts/${contact.id}`} data-testid={`link-contact-${contact.id}`}>
                  <div className="group bg-card hover:bg-card/80 border border-border rounded-xl p-4 transition-all duration-200 hover:shadow-md cursor-pointer flex items-center gap-4" data-testid={`card-contact-${contact.id}`}>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                      {contact.name[0]}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h3 className="text-base font-bold font-display text-foreground truncate group-hover:text-primary transition-colors" data-testid={`text-name-${contact.id}`}>
                          {contact.name}
                        </h3>
                        <Badge variant="secondary" className="text-[10px] h-5 px-2 font-medium shrink-0" data-testid={`text-role-${contact.id}`}>
                          {contact.role}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {contact.businessName && (
                          <p className="text-xs text-foreground/70 truncate max-w-[200px]" data-testid={`text-business-${contact.id}`}>
                            {contact.businessName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground truncate" data-testid={`text-email-${contact.id}`}>
                          {contact.email || "No email"}
                        </p>
                        <p className="text-xs text-primary/80 font-medium">
                          {contact.lastInteractionDate
                            ? `Last active: ${format(new Date(contact.lastInteractionDate), "MMM d, yyyy")}`
                            : `Added: ${format(new Date(contact.createdAt || Date.now()), "MMM d, yyyy")}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        {(() => {
                          const total = (contact.interactionCount || 0) + (contact.eventCount || 0);
                          return (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`stat-interactions-${contact.id}`}>
                              <MessageSquare className="w-3 h-3" />
                              {total} interaction{total !== 1 ? 's' : ''}
                            </span>
                          );
                        })()}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`stat-debriefs-${contact.id}`}>
                          <FileText className="w-3 h-3" />
                          {contact.debriefCount || 0} debrief{contact.debriefCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-[200px] shrink-0">
                      {contact.tags && contact.tags.length > 0 ? (
                        contact.tags.slice(0, 2).map((tag: string, i: number) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground border border-border/50">
                            #{tag}
                          </span>
                        ))
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const ETHNIC_GROUPS = [
  "European",
  "Māori",
  "Pacific Peoples",
  "Asian",
  "Middle Eastern/Latin American/African",
  "Other"
];

const REVENUE_BANDS = [
  "Pre-revenue",
  "$0-10k",
  "$10k-50k",
  "$50k-100k",
  "$100k+",
];

function CreateContactDialogContent({ onSuccess }: { onSuccess: () => void }) {
  const { mutate, isPending } = useCreateContact();
  const [metricScores, setMetricScores] = useState<{
    confidenceScore?: number;
    systemsInPlace?: number;
    fundingReadiness?: number;
    networkStrength?: number;
  }>({});
  const formSchema = insertContactSchema.extend({
    age: z.union([z.number().int().positive(), z.nan(), z.undefined()]).optional().transform(v => (typeof v === 'number' && !Number.isNaN(v)) ? v : undefined),
    email: z.string().optional().transform(v => v === '' ? undefined : v),
    businessName: z.string().optional().transform(v => v === '' ? undefined : v),
    location: z.string().optional().transform(v => v === '' ? undefined : v),
    revenueBand: z.string().optional().transform(v => v === '' ? undefined : v),
  });
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: "temp",
      name: "",
      businessName: "",
      email: "",
      age: undefined,
      ethnicity: [],
      location: "",
      role: "Entrepreneur",
      revenueBand: "",
      tags: [],
    },
  });

  const onSubmit = (data: ContactFormValues) => {
    const payload = {
      ...data,
      metrics: { ...metricScores },
    };
    mutate(payload, {
      onSuccess: () => {
        form.reset();
        setMetricScores({});
        onSuccess();
      },
    });
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Add New Community Member</DialogTitle>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit, (errors) => console.error("Form validation errors:", errors))} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto px-1">
        {Object.keys(form.formState.errors).length > 0 && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3" data-testid="form-errors">
            Please fix the following: {Object.entries(form.formState.errors).map(([key, err]) => (
              <span key={key} className="block">{key}: {String((err as any)?.message || "invalid")}</span>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" data-testid="input-contact-name" {...form.register("name")} placeholder="e.g. Jane Doe" />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{String((form.formState.errors.name as any)?.message || "Required")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessName">Business / Brand Name</Label>
          <Input id="businessName" data-testid="input-contact-business" {...form.register("businessName")} placeholder="e.g. Acme Ltd (leave blank if N/A)" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" {...form.register("email")} placeholder="jane@example.com" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input id="age" {...form.register("age", { valueAsNumber: true })} type="number" placeholder="30" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Ethnicity (Select all that apply)</Label>
          <div className="grid grid-cols-2 gap-2 mt-2 bg-muted/30 p-3 rounded-lg border border-border">
            {ETHNIC_GROUPS.map((group) => (
              <label key={group} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors">
                <input
                  type="checkbox"
                  value={group}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  onChange={(e) => {
                    const currentValues = form.getValues("ethnicity") || [];
                    if (e.target.checked) {
                      form.setValue("ethnicity", [...currentValues, group]);
                    } else {
                      form.setValue("ethnicity", currentValues.filter((v: string) => v !== group));
                    }
                  }}
                />
                <span>{group}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" {...form.register("location")} placeholder="e.g. Auckland Central" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <select 
            id="role" 
            {...form.register("role")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="Entrepreneur">Entrepreneur</option>
            <option value="Professional">Professional</option>
            <option value="Innovator">Innovator</option>
            <option value="Want-trepreneur">Want-trepreneur</option>
            <option value="Rangatahi">Rangatahi</option>
            <option value="Business Owner">Business Owner</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="revenueBand">Revenue Band</Label>
          <select
            id="revenueBand"
            {...form.register("revenueBand")}
            data-testid="select-revenue-band"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Not set</option>
            {REVENUE_BANDS.map(band => (
              <option key={band} value={band}>{band}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Baseline Scores (1-10)</Label>
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border">
            <div className="space-y-1">
              <Label htmlFor="confidenceScore" className="text-xs text-muted-foreground">Confidence Score</Label>
              <Input
                id="confidenceScore"
                type="number"
                min={1}
                max={10}
                data-testid="input-confidence-score"
                placeholder="1-10"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= 10) setMetricScores(prev => ({ ...prev, confidenceScore: val }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="systemsInPlace" className="text-xs text-muted-foreground">Systems in Place</Label>
              <Input
                id="systemsInPlace"
                type="number"
                min={1}
                max={10}
                data-testid="input-systems-in-place"
                placeholder="1-10"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= 10) setMetricScores(prev => ({ ...prev, systemsInPlace: val }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fundingReadiness" className="text-xs text-muted-foreground">Funding Readiness</Label>
              <Input
                id="fundingReadiness"
                type="number"
                min={1}
                max={10}
                data-testid="input-funding-readiness"
                placeholder="1-10"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= 10) setMetricScores(prev => ({ ...prev, fundingReadiness: val }));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="networkStrength" className="text-xs text-muted-foreground">Network Strength</Label>
              <Input
                id="networkStrength"
                type="number"
                min={1}
                max={10}
                data-testid="input-network-strength"
                placeholder="1-10"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= 10) setMetricScores(prev => ({ ...prev, networkStrength: val }));
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input 
            id="tags" 
            placeholder="javascript, startup, leadership" 
            onChange={(e) => {
              const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
              form.setValue('tags', tags);
            }}
          />
        </div>

        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isPending} className="w-full" data-testid="button-submit-contact">
            {isPending ? <><Loader2 className="animate-spin" /> Adding...</> : "Add to Community"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function parseCSVFields(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let fields: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = "";
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        fields.push(current.trim());
        if (fields.some(f => f !== "")) rows.push(fields);
        fields = [];
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  if (fields.some(f => f !== "")) rows.push(fields);
  return rows;
}

function parseCSV(text: string): Record<string, string>[] {
  const allRows = parseCSVFields(text);
  if (allRows.length < 2) return [];
  const rawHeaders = allRows[0];
  const headerMap: Record<number, string> = {};
  for (let idx = 0; idx < rawHeaders.length; idx++) {
    const h = rawHeaders[idx];
    const lower = h.toLowerCase().replace(/[^a-z]/g, "");
    if (lower.includes("name") && !lower.includes("business")) headerMap[idx] = "name";
    else if (lower.includes("business") || lower.includes("brand") || lower.includes("company")) headerMap[idx] = "businessName";
    else if (lower.includes("email")) headerMap[idx] = "email";
    else if (lower.includes("phone") || lower.includes("mobile")) headerMap[idx] = "phone";
    else if (lower.includes("role") || lower.includes("type")) headerMap[idx] = "role";
    else if (lower.includes("age")) headerMap[idx] = "age";
    else if (lower.includes("ethnic")) headerMap[idx] = "ethnicity";
    else if (lower.includes("location") || lower.includes("city") || lower.includes("region")) headerMap[idx] = "location";
    else if (lower.includes("tag")) headerMap[idx] = "tags";
    else if (lower.includes("note")) headerMap[idx] = "notes";
  }

  return allRows.slice(1).map(fields => {
    const row: Record<string, string> = {};
    fields.forEach((val, i) => {
      const key = headerMap[i] || rawHeaders[i];
      if (val && key) row[key] = val;
    });
    return row;
  }).filter(r => r.name);
}

function BulkUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploadResult, setUploadResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);

  const bulkMutation = useMutation({
    mutationFn: async (contacts: Record<string, string>[]) => {
      const res = await apiRequest("POST", "/api/contacts/bulk", { contacts });
      return res.json();
    },
    onSuccess: (result) => {
      setUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      if (result.created > 0) {
        toast({ title: `${result.created} contacts imported` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  }, []);

  const handleUpload = () => {
    if (parsedRows.length === 0) return;
    bulkMutation.mutate(parsedRows);
  };

  const handleClose = () => {
    onOpenChange(false);
    setParsedRows([]);
    setFileName("");
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Upload Contacts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Upload a CSV file with your contacts. Need a starting point?</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const template = [
                  "Name,Email,Phone,Role,Business Name,Age,Ethnicity,Location,Tags,Notes",
                  "Jane Doe,jane@example.com,021 123 4567,Entrepreneur,Doe Designs,28,Māori,Auckland Central,\"startup, design\",First session completed",
                  "John Smith,john@example.com,022 987 6543,Business Owner,Smith & Co,35,\"European, Pacific Peoples\",Mount Wellington,leadership,Referred by Ra",
                ].join("\n");
                const blob = new Blob([template], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "contacts_template.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              data-testid="button-download-template"
            >
              <FileUp className="w-3.5 h-3.5 mr-1.5" />
              Download CSV Template
            </Button>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-primary/50"
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-csv"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-csv-file"
            />
            <FileUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            {fileName ? (
              <p className="text-sm font-medium text-foreground">{fileName}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
            )}
          </div>

          {parsedRows.length > 0 && !uploadResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium" data-testid="text-preview-count">
                  {parsedRows.length} contact{parsedRows.length !== 1 ? "s" : ""} found
                </p>
                <Badge variant="secondary">{fileName}</Badge>
              </div>
              <div className="max-h-48 overflow-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">#</th>
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-left p-2 font-medium">Role</th>
                      <th className="text-left p-2 font-medium">Email</th>
                      <th className="text-left p-2 font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-border/50" data-testid={`row-preview-${i}`}>
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2">{row.name}</td>
                        <td className="p-2">{row.role || "Entrepreneur"}</td>
                        <td className="p-2 text-muted-foreground">{row.email || "-"}</td>
                        <td className="p-2 text-muted-foreground">{row.location || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ...and {parsedRows.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="text-sm font-medium text-green-700" data-testid="text-upload-success">
                  {uploadResult.created} contact{uploadResult.created !== 1 ? "s" : ""} imported successfully
                </span>
              </div>
              {uploadResult.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {uploadResult.errors.length} row{uploadResult.errors.length !== 1 ? "s" : ""} had errors
                  </div>
                  <div className="max-h-32 overflow-auto text-xs space-y-1">
                    {uploadResult.errors.map((err, i) => (
                      <p key={i} className="text-muted-foreground" data-testid={`text-upload-error-${i}`}>
                        Row {err.row}: {err.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-bulk">
            {uploadResult ? "Done" : "Cancel"}
          </Button>
          {!uploadResult && (
            <Button
              onClick={handleUpload}
              disabled={parsedRows.length === 0 || bulkMutation.isPending}
              data-testid="button-import-contacts"
            >
              {bulkMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importing...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Import {parsedRows.length} Contact{parsedRows.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
