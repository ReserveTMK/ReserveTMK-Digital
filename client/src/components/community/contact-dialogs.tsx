import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContactSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/beautiful-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Upload, FileUp, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCreateContact } from "@/hooks/use-contacts";

type ContactFormValues = Record<string, any>;

const ETHNIC_GROUPS = [
  "European",
  "M\u0101ori",
  "Pacific Peoples",
  "Asian",
  "Middle Eastern/Latin American/African",
  "Other"
];

const REVENUE_BANDS = [
  "Koha / Donations",
  "Sponsorship",
  "Pre-revenue",
  "$0-10k",
  "$10k-50k",
  "$50k-100k",
  "$100k+",
];

export function CreateContactDialogContent({ onSuccess }: { onSuccess: () => void }) {
  const { mutate, isPending } = useCreateContact();
  const [metricScores, setMetricScores] = useState<{
    bizConfidence?: number;
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
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="businessName">Group</Label>
            <Link href="/community/groups" className="text-xs text-primary/80 hover:text-primary transition-colors" data-testid="link-manage-groups">
              Manage Groups
            </Link>
          </div>
          <Input id="businessName" data-testid="input-contact-business" {...form.register("businessName")} placeholder="e.g. business, brand, collective, movement" />
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
          <Select value={form.watch("role") || "Entrepreneur"} onValueChange={(v) => form.setValue("role", v)}>
            <SelectTrigger data-testid="select-role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Entrepreneur">Entrepreneur</SelectItem>
              <SelectItem value="Creative">Creative</SelectItem>
              <SelectItem value="Community Leader">Community Leader</SelectItem>
              <SelectItem value="Movement Builder">Movement Builder</SelectItem>
              <SelectItem value="Professional">Professional</SelectItem>
              <SelectItem value="Innovator">Innovator</SelectItem>
              <SelectItem value="Rangatahi">Rangatahi</SelectItem>
              <SelectItem value="Aspiring">Aspiring</SelectItem>
              <SelectItem value="Business Owner">Business Owner</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="revenueBand">Income Band</Label>
          <Select value={form.watch("revenueBand") || ""} onValueChange={(v) => form.setValue("revenueBand", v === "__none__" ? "" : v)}>
            <SelectTrigger data-testid="select-revenue-band">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Not set</SelectItem>
              {REVENUE_BANDS.map(band => (
                <SelectItem key={band} value={band}>{band}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">Baseline Scores (1-10)</Label>
          <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border">
            <div className="space-y-1">
              <Label htmlFor="bizConfidence" className="text-xs text-muted-foreground">Biz Confidence</Label>
              <Input
                id="bizConfidence"
                type="number"
                min={1}
                max={10}
                data-testid="input-biz-confidence"
                placeholder="1-10"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= 10) setMetricScores(prev => ({ ...prev, bizConfidence: val }));
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
    else if (lower.includes("business") || lower.includes("brand") || lower.includes("company") || lower.includes("venture") || lower.includes("project")) headerMap[idx] = "businessName";
    else if (lower.includes("email")) headerMap[idx] = "email";
    else if (lower.includes("phone") || lower.includes("mobile")) headerMap[idx] = "phone";
    else if (lower.includes("venturetype")) headerMap[idx] = "ventureType";
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

export function BulkUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
                  "Name,Email,Phone,Role,Venture,Age,Ethnicity,Location,Tags,Notes",
                  "Jane Doe,jane@example.com,021 123 4567,Entrepreneur,Doe Designs,28,M\u0101ori,Auckland Central,\"startup, design\",First session completed",
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

export function CleanUpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [junkContacts, setJunkContacts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const fetchJunk = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/contacts/community/junk-scan", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to scan for junk contacts");
      const data = await res.json();
      const contacts = data.junkContacts || data || [];
      setJunkContacts(contacts);
      setSelectedIds(new Set(contacts.map((c: any) => c.id)));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const bulkDeleteMutation = useMutation({
    mutationFn: async (contactIds: number[]) => {
      const res = await apiRequest("POST", "/api/contacts/community/bulk-delete", { contactIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Cleaned Up", description: `${data.deleted ?? selectedIds.size} contacts removed.` });
      onOpenChange(false);
      setJunkContacts([]);
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      fetchJunk();
    } else {
      setJunkContacts([]);
      setSelectedIds(new Set());
    }
  };

  const toggleId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === junkContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(junkContacts.map((c: any) => c.id)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Clean Up Junk Contacts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : junkContacts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
              <p className="text-sm font-medium" data-testid="text-no-junk">No junk contacts found</p>
              <p className="text-xs text-muted-foreground mt-1">Your contact list looks clean.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground" data-testid="text-junk-count">
                  {junkContacts.length} junk contact{junkContacts.length !== 1 ? "s" : ""} found
                </p>
                <Button variant="ghost" size="sm" onClick={toggleAll} data-testid="button-toggle-all-junk">
                  {selectedIds.size === junkContacts.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="max-h-64 overflow-auto border border-border rounded-lg">
                {junkContacts.map((contact: any) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-3 border-b border-border/50 last:border-b-0"
                    data-testid={`junk-contact-${contact.id}`}
                  >
                    <Checkbox
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={() => toggleId(contact.id)}
                      data-testid={`checkbox-junk-${contact.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{contact.email || contact.reason || "No email"}</p>
                    </div>
                    {contact.reason && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">{contact.reason}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpen(false)} data-testid="button-cancel-cleanup">
            Cancel
          </Button>
          {junkContacts.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
              data-testid="button-delete-selected"
            >
              {bulkDeleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Deleting...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.size})</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
