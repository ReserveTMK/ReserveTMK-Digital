import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useRegularBookers,
  useCreateRegularBooker,
  useUpdateRegularBooker,
  useDeleteRegularBooker,
  useBookings,
  useAllBookerLinks,
} from "@/hooks/use-bookings";
import { useContacts } from "@/hooks/use-contacts";
import { useGroups } from "@/hooks/use-groups";
import { useMemberships, useMous } from "@/hooks/use-memberships";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
  Users,
  X,
  Copy,
  Building,
  CheckCircle2,
  UserPlus,
  Link2,
  ChevronDown,
  ChevronUp,
  FileText,
  Monitor,
  Wrench,
  Home,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { getAgreementAllowanceUsage, getPeriodLabel } from "@/lib/utils";
import { PRICING_TIERS, REGULAR_BOOKER_STATUSES, PAYMENT_TERMS, type Contact, type RegularBooker, type Group } from "@shared/schema";

const PRICING_LABELS: Record<string, string> = {
  full_price: "Full Price",
  discounted: "Discounted",
  free_koha: "Free / Koha",
};

const TIER_BADGE_COLORS: Record<string, string> = {
  full_price: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  discounted: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  free_koha: "bg-green-500/15 text-green-700 dark:text-green-300",
};

const ACCOUNT_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/15 text-green-700 dark:text-green-300",
  inactive: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  suspended: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const LINK_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/15 text-green-700 dark:text-green-300",
  expired: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  none: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

const PAYMENT_TERM_LABELS: Record<string, string> = {
  immediate: "Immediate",
  net_7: "Net 7 days",
  net_14: "Net 14 days",
  net_30: "Net 30 days",
};

export default function RegularBookersPage() {
  const { data: regularBookers, isLoading } = useRegularBookers();
  const { data: allBookerLinks, isLoading: linksLoading } = useAllBookerLinks();
  const { data: contacts } = useContacts();
  const { data: groups } = useGroups();
  const createMutation = useCreateRegularBooker();
  const updateMutation = useUpdateRegularBooker();
  const deleteMutation = useDeleteRegularBooker();
  const { toast } = useToast();
  const { data: allMemberships } = useMemberships();
  const { data: allMous } = useMous();
  const { data: allBookings } = useBookings();

  const [editingBooker, setEditingBooker] = useState<RegularBooker | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [createdPortalUrl, setCreatedPortalUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [agreementFilter, setAgreementFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [linkFilter, setLinkFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [prefillData, setPrefillData] = useState<{ contactId?: number; groupId?: number; billingEmail?: string; organizationName?: string } | null>(null);

  const { data: suggestions } = useQuery<{
    venueContacts: { id: number; name: string; email: string; supportType: string[] }[];
    agreementContacts: { id: number; name: string; email: string }[];
    agreementGroups: { id: number; name: string; type: string }[];
  }>({
    queryKey: ['/api/regular-bookers/suggestions'],
  });

  const generateLinkMutation = useMutation({
    mutationFn: async (bookerId: number) => {
      const res = await apiRequest("POST", `/api/regular-bookers/${bookerId}/links`, { label: "Portal link" });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/all-booker-links'] });
      if (data.portalUrl) {
        navigator.clipboard.writeText(data.portalUrl).then(() => {
          toast({ title: "Link generated and copied", description: data.portalUrl });
        }).catch(() => {
          toast({ title: "Link generated", description: data.portalUrl });
        });
      }
    },
    onError: (err: any) => {
      toast({ title: "Failed to generate link", description: err.message, variant: "destructive" });
    },
  });

  const getBookerDisplayName = (booker: RegularBooker) => {
    const contactName = booker.contactId ? (contacts || []).find(c => c.id === booker.contactId)?.name : null;
    const groupName = booker.groupId ? (groups || []).find((g: any) => g.id === booker.groupId)?.name : null;
    if (contactName && groupName) return contactName;
    if (groupName) return groupName;
    if (contactName) return contactName;
    return booker.organizationName || `Booker #${booker.id}`;
  };

  const getBookerGroupName = (booker: RegularBooker) => {
    if (!booker.groupId) return null;
    return (groups || []).find((g: any) => g.id === booker.groupId)?.name || null;
  };

  const getAgreementInfo = (booker: RegularBooker) => {
    if (booker.membershipId) {
      const m = allMemberships?.find(ms => ms.id === booker.membershipId);
      return m ? { type: "Membership" as const, name: m.name, agreement: m } : null;
    }
    if (booker.mouId) {
      const m = allMous?.find(ms => ms.id === booker.mouId);
      return m ? { type: "MOU" as const, name: m.title, agreement: m } : null;
    }
    return null;
  };

  const getBookerLinks = (bookerId: number) => {
    if (!allBookerLinks) return [];
    return allBookerLinks.filter(l => l.regularBookerId === bookerId);
  };

  const getLinkStatus = (booker: RegularBooker) => {
    const links = getBookerLinks(booker.id);
    if (links.length === 0) return { status: "none" as const, label: "No link", links: [] };
    const activeLinks = links.filter((l: any) => l.enabled !== false);
    if (activeLinks.length === 0) return { status: "expired" as const, label: "Expired", links };
    const lastAccessed = activeLinks.reduce((latest: any, l: any) => {
      if (!l.lastAccessedAt) return latest;
      return !latest || new Date(l.lastAccessedAt) > new Date(latest) ? l.lastAccessedAt : latest;
    }, null);
    return { status: "active" as const, label: lastAccessed ? `Active` : "Active (unused)", links: activeLinks, lastAccessed };
  };

  const getBookerCategories = (booker: RegularBooker): string[] => {
    const agreement = getAgreementInfo(booker);
    if (!agreement) return ["venue_hire"];
    const ag = agreement.agreement as any;
    const cats = ag?.bookingCategories;
    if (Array.isArray(cats) && cats.length > 0) return cats;
    return ["venue_hire"];
  };

  const getPackageInfo = (booker: RegularBooker) => {
    const agreement = getAgreementInfo(booker);
    if (agreement) {
      const ag = agreement.agreement as any;
      const allowance = ag?.bookingAllowance;
      const period = ag?.allowancePeriod || "quarterly";
      if (!allowance) return null;
      const type = booker.membershipId ? "membership" as const : "mou" as const;
      const id = (booker.membershipId || booker.mouId)!;
      const used = getAgreementAllowanceUsage(allBookings, type, id, period);
      const remaining = Math.max(0, allowance - used);
      return { used, total: allowance, remaining, period: getPeriodLabel(period), source: "agreement" as const };
    }
    if (booker.hasBookingPackage && booker.packageTotalBookings) {
      const used = booker.packageUsedBookings || 0;
      const total = booker.packageTotalBookings;
      const remaining = Math.max(0, total - used);
      return { used, total, remaining, period: booker.packageExpiresAt ? `expires ${format(new Date(booker.packageExpiresAt), "d MMM yyyy")}` : null, source: "package" as const };
    }
    return null;
  };

  const getCategoryStatusInfo = (booker: RegularBooker) => {
    const agreement = getAgreementInfo(booker);
    if (!agreement) return null;
    const ag = agreement.agreement as any;
    const cats: string[] = ag?.bookingCategories || [];
    const endDate = ag?.endDate;
    const result: { category: string; label: string; status: "active" | "expired" | "allowance" }[] = [];

    if (cats.includes("venue_hire")) {
      const allowance = ag?.bookingAllowance;
      if (allowance) {
        const type = booker.membershipId ? "membership" as const : "mou" as const;
        const id = (booker.membershipId || booker.mouId)!;
        const period = ag?.allowancePeriod || "quarterly";
        const used = getAgreementAllowanceUsage(allBookings, type, id, period);
        result.push({ category: "venue_hire", label: `${used}/${allowance} bookings used`, status: "allowance" });
      }
    }

    if (cats.includes("hot_desking")) {
      if (endDate) {
        const exp = new Date(endDate);
        const isExpired = exp < new Date();
        result.push({
          category: "hot_desking",
          label: isExpired ? `Expired ${format(exp, "d MMM yyyy")}` : `Active (expires ${format(exp, "d MMM yyyy")})`,
          status: isExpired ? "expired" : "active",
        });
      } else {
        result.push({ category: "hot_desking", label: "Active (no expiry)", status: "active" });
      }
    }

    if (cats.includes("gear")) {
      if (endDate) {
        const exp = new Date(endDate);
        const isExpired = exp < new Date();
        result.push({
          category: "gear",
          label: isExpired ? `Expired ${format(exp, "d MMM yyyy")}` : `Active (expires ${format(exp, "d MMM yyyy")})`,
          status: isExpired ? "expired" : "active",
        });
      } else {
        result.push({ category: "gear", label: "Active (no expiry)", status: "active" });
      }
    }

    return result.length > 0 ? result : null;
  };

  const copyLink = (portalUrl: string) => {
    navigator.clipboard.writeText(portalUrl).then(() => {
      toast({ title: "Link copied to clipboard", description: portalUrl });
    }).catch(() => {
      toast({ title: "Portal URL", description: portalUrl });
    });
  };

  const filtered = useMemo(() => {
    if (!regularBookers) return [];
    return regularBookers.filter(booker => {
      if (search) {
        const name = getBookerDisplayName(booker).toLowerCase();
        const group = getBookerGroupName(booker)?.toLowerCase() || "";
        const org = (booker.organizationName || "").toLowerCase();
        const email = (booker.billingEmail || "").toLowerCase();
        const term = search.toLowerCase();
        if (!name.includes(term) && !group.includes(term) && !org.includes(term) && !email.includes(term)) return false;
      }
      if (agreementFilter !== "all") {
        const ag = getAgreementInfo(booker);
        if (agreementFilter === "membership" && !ag?.type?.includes("Membership")) return false;
        if (agreementFilter === "mou" && !ag?.type?.includes("MOU")) return false;
        if (agreementFilter === "none" && ag) return false;
      }
      if (tierFilter !== "all" && booker.pricingTier !== tierFilter) return false;
      if (linkFilter !== "all") {
        const linkStatus = getLinkStatus(booker);
        if (linkFilter === "active" && linkStatus.status !== "active") return false;
        if (linkFilter === "none" && linkStatus.status !== "none") return false;
        if (linkFilter === "expired" && linkStatus.status !== "expired") return false;
      }
      if (packageFilter !== "all") {
        const pkg = getPackageInfo(booker);
        if (packageFilter === "has" && !pkg) return false;
        if (packageFilter === "none" && pkg) return false;
      }
      if (categoryFilter !== "all") {
        const cats = getBookerCategories(booker);
        if (!cats.includes(categoryFilter)) return false;
      }
      return true;
    });
  }, [regularBookers, search, agreementFilter, tierFilter, linkFilter, packageFilter, categoryFilter, allBookerLinks, allMemberships, allMous, allBookings]);

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Deleted", description: "Regular booker removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    }
  };

  const hasFilters = agreementFilter !== "all" || tierFilter !== "all" || linkFilter !== "all" || packageFilter !== "all" || categoryFilter !== "all";

  const totalSuggestions = (suggestions?.venueContacts?.length || 0) + (suggestions?.agreementContacts?.length || 0) + (suggestions?.agreementGroups?.length || 0);

  const handleSetupSuggestion = (type: "venueContact" | "agreementContact" | "agreementGroup", item: any) => {
    if (type === "agreementGroup") {
      setPrefillData({ groupId: item.id, organizationName: item.name });
    } else {
      setPrefillData({ contactId: item.id, billingEmail: item.email || "" });
    }
    setEditingBooker(null);
    setFormOpen(true);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-regular-bookers">Regular Bookers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage regular bookers, their agreements, packages, and portal links.</p>
        </div>
        <Button onClick={() => { setEditingBooker(null); setPrefillData(null); setFormOpen(true); }} data-testid="button-add-regular-booker">
          <Plus className="w-4 h-4 mr-2" />
          Add Booker
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search bookers..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-regular-bookers"
          />
        </div>
        <Select value={agreementFilter} onValueChange={setAgreementFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-agreement-filter">
            <SelectValue placeholder="Agreement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agreements</SelectItem>
            <SelectItem value="membership">Membership</SelectItem>
            <SelectItem value="mou">MOU</SelectItem>
            <SelectItem value="none">No Agreement</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-tier-filter">
            <SelectValue placeholder="Pricing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="full_price">Full Price</SelectItem>
            <SelectItem value="discounted">Discounted</SelectItem>
            <SelectItem value="free_koha">Free / Koha</SelectItem>
          </SelectContent>
        </Select>
        <Select value={linkFilter} onValueChange={setLinkFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-link-filter">
            <SelectValue placeholder="Link Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Links</SelectItem>
            <SelectItem value="active">Has Active Link</SelectItem>
            <SelectItem value="none">No Link</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-category-filter">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="venue_hire">Venue Hire</SelectItem>
            <SelectItem value="hot_desking">Hot Desking</SelectItem>
            <SelectItem value="gear">Gear Borrowers</SelectItem>
          </SelectContent>
        </Select>
        <Select value={packageFilter} onValueChange={setPackageFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-package-filter">
            <SelectValue placeholder="Package" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="has">Has Package</SelectItem>
            <SelectItem value="none">No Package</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setAgreementFilter("all"); setTierFilter("all"); setLinkFilter("all"); setPackageFilter("all"); setCategoryFilter("all"); }}
            data-testid="button-clear-filters"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {isLoading || linksLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !regularBookers?.length ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1" data-testid="text-no-regular-bookers">No regular bookers yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Set up regular bookers to manage recurring venue hire clients.</p>
          <Button onClick={() => { setEditingBooker(null); setFormOpen(true); }} data-testid="button-add-first-booker">
            <Plus className="w-4 h-4 mr-2" />
            Add First Booker
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">No bookers match your filters.</p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]" data-testid="th-booker-name">Booker</TableHead>
                <TableHead className="min-w-[120px]" data-testid="th-categories">Categories</TableHead>
                <TableHead className="min-w-[120px]" data-testid="th-agreement">Agreement</TableHead>
                <TableHead className="min-w-[180px]" data-testid="th-package">Package / Balance</TableHead>
                <TableHead className="min-w-[100px]" data-testid="th-pricing">Pricing</TableHead>
                <TableHead className="min-w-[120px]" data-testid="th-link">Portal Link</TableHead>
                <TableHead className="min-w-[80px]" data-testid="th-status">Status</TableHead>
                <TableHead className="w-[100px] text-right" data-testid="th-actions">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((booker) => {
                const agreement = getAgreementInfo(booker);
                const linkStatus = getLinkStatus(booker);
                const pkg = getPackageInfo(booker);
                const groupName = getBookerGroupName(booker);
                const categories = getBookerCategories(booker);
                const categoryStatus = getCategoryStatusInfo(booker);

                return (
                  <TableRow key={booker.id} data-testid={`row-booker-${booker.id}`}>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm" data-testid={`text-booker-name-${booker.id}`}>
                          {getBookerDisplayName(booker)}
                        </span>
                        {groupName && getBookerDisplayName(booker) !== groupName ? (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1" data-testid={`text-booker-group-${booker.id}`}>
                            <Building className="w-3 h-3 shrink-0" />
                            {groupName}
                          </p>
                        ) : booker.organizationName && getBookerDisplayName(booker) !== booker.organizationName ? (
                          <p className="text-xs text-muted-foreground truncate" data-testid={`text-booker-org-${booker.id}`}>
                            {booker.organizationName}
                          </p>
                        ) : booker.billingEmail ? (
                          <p className="text-xs text-muted-foreground truncate" data-testid={`text-booker-email-${booker.id}`}>
                            {booker.billingEmail}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {categories.includes("venue_hire") && (
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" data-testid={`badge-cat-venue-${booker.id}`}>
                            <Home className="w-3 h-3 mr-0.5" />
                            Venue
                          </Badge>
                        )}
                        {categories.includes("hot_desking") && (
                          <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800" data-testid={`badge-cat-desk-${booker.id}`}>
                            <Monitor className="w-3 h-3 mr-0.5" />
                            Desk
                          </Badge>
                        )}
                        {categories.includes("gear") && (
                          <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800" data-testid={`badge-cat-gear-${booker.id}`}>
                            <Wrench className="w-3 h-3 mr-0.5" />
                            Gear
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {agreement ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-[10px] gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 cursor-default" data-testid={`badge-agreement-${booker.id}`}>
                              <FileText className="w-3 h-3" />
                              {agreement.type}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{agreement.type}: {agreement.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {categoryStatus && categoryStatus.length > 0 ? (
                        <div className="space-y-1">
                          {categoryStatus.map((cs) => (
                            <div key={cs.category} className="text-xs flex items-center gap-1.5" data-testid={`text-cat-status-${cs.category}-${booker.id}`}>
                              {cs.category === "venue_hire" && <Home className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />}
                              {cs.category === "hot_desking" && <Monitor className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />}
                              {cs.category === "gear" && <Wrench className="w-3 h-3 text-orange-600 dark:text-orange-400 shrink-0" />}
                              <span className={cs.status === "expired" ? "text-red-600 dark:text-red-400" : cs.status === "active" ? "text-green-700 dark:text-green-400" : ""}>
                                {cs.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : pkg ? (
                        <div className="text-xs">
                          <span className={`font-medium ${pkg.remaining === 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                            {pkg.used}/{pkg.total}
                          </span>
                          <span className="text-muted-foreground ml-1">used</span>
                          {pkg.remaining > 0 && (
                            <Badge variant="secondary" className="text-[9px] ml-1.5" data-testid={`badge-remaining-${booker.id}`}>
                              {pkg.remaining} left
                            </Badge>
                          )}
                          {pkg.remaining === 0 && (
                            <Badge variant="secondary" className="text-[9px] ml-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                              Exhausted
                            </Badge>
                          )}
                          {pkg.period && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{pkg.source === "agreement" ? `per ${pkg.period}` : pkg.period}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${TIER_BADGE_COLORS[booker.pricingTier] || ""} text-[10px]`} data-testid={`badge-tier-${booker.id}`}>
                        {PRICING_LABELS[booker.pricingTier] || booker.pricingTier}
                      </Badge>
                      {booker.pricingTier === "discounted" && parseFloat(booker.discountPercentage || "0") > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{booker.discountPercentage}% off</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge className={`${LINK_STATUS_COLORS[linkStatus.status]} text-[10px]`} data-testid={`badge-link-${booker.id}`}>
                          {linkStatus.label}
                        </Badge>
                        {linkStatus.status === "active" && linkStatus.lastAccessed && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] text-muted-foreground cursor-default">
                                {format(new Date(linkStatus.lastAccessed), "d MMM")}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Last accessed {format(new Date(linkStatus.lastAccessed), "d MMM yyyy")}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={ACCOUNT_STATUS_COLORS[booker.accountStatus] || ""} data-testid={`badge-status-${booker.id}`}>
                        {booker.accountStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {linkStatus.links.length > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyLink(linkStatus.links[0].portalUrl)}
                                data-testid={`button-copy-link-${booker.id}`}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy portal link</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => generateLinkMutation.mutate(booker.id)}
                                disabled={generateLinkMutation.isPending}
                                data-testid={`button-gen-link-${booker.id}`}
                              >
                                {generateLinkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Generate portal link</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingBooker(booker); setFormOpen(true); }}
                              data-testid={`button-edit-booker-${booker.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit booker</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(booker.id)}
                              data-testid={`button-delete-booker-${booker.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete booker</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span data-testid="text-booker-count">{filtered.length} of {regularBookers?.length || 0} booker{(regularBookers?.length || 0) !== 1 ? "s" : ""}</span>
        {hasFilters && <span>Filters active</span>}
      </div>

      {totalSuggestions > 0 && (
        <Collapsible open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
          <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" data-testid="card-suggested-bookers">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between gap-2 p-3 cursor-pointer" data-testid="button-toggle-suggestions">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium">Suggested Bookers</span>
                  <Badge variant="secondary" className="text-[10px]" data-testid="badge-suggestion-count">{totalSuggestions}</Badge>
                </div>
                {suggestionsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-1">
                {suggestions?.venueContacts?.map(contact => (
                  <div key={`vc-${contact.id}`} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50" data-testid={`suggestion-venue-contact-${contact.id}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block" data-testid={`text-suggestion-name-vc-${contact.id}`}>{contact.name}</span>
                        {contact.email && <span className="text-xs text-muted-foreground truncate block">{contact.email}</span>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {contact.supportType?.includes("venue_hire") ? "Venue hire contact" : "Hot desking contact"}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => handleSetupSuggestion("venueContact", contact)} data-testid={`button-setup-suggestion-vc-${contact.id}`}>
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                      Set up
                    </Button>
                  </div>
                ))}
                {suggestions?.agreementContacts?.map(contact => (
                  <div key={`ac-${contact.id}`} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50" data-testid={`suggestion-agreement-contact-${contact.id}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block" data-testid={`text-suggestion-name-ac-${contact.id}`}>{contact.name}</span>
                        {contact.email && <span className="text-xs text-muted-foreground truncate block">{contact.email}</span>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">Has active membership</Badge>
                    <Button size="sm" variant="outline" onClick={() => handleSetupSuggestion("agreementContact", contact)} data-testid={`button-setup-suggestion-ac-${contact.id}`}>
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                      Set up
                    </Button>
                  </div>
                ))}
                {suggestions?.agreementGroups?.map(group => (
                  <div key={`ag-${group.id}`} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50" data-testid={`suggestion-agreement-group-${group.id}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Building className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block" data-testid={`text-suggestion-name-ag-${group.id}`}>{group.name}</span>
                        {group.type && <span className="text-xs text-muted-foreground truncate block">{group.type}</span>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">Has active agreement</Badge>
                    <Button size="sm" variant="outline" onClick={() => handleSetupSuggestion("agreementGroup", group)} data-testid={`button-setup-suggestion-ag-${group.id}`}>
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                      Set up
                    </Button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <RegularBookerFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) { setEditingBooker(null); setPrefillData(null); } }}
        booker={editingBooker}
        contacts={contacts || []}
        groups={groups || []}
        prefill={prefillData}
        onSubmit={async (data) => {
          try {
            if (editingBooker) {
              await updateMutation.mutateAsync({ id: editingBooker.id, data });
              toast({ title: "Updated", description: "Regular booker updated" });
            } else {
              const result = await createMutation.mutateAsync(data);
              if (result?.portalUrl) {
                setCreatedPortalUrl(result.portalUrl);
                navigator.clipboard.writeText(result.portalUrl).catch(() => {});
              } else {
                toast({ title: "Created", description: "Regular booker added" });
              }
            }
            setFormOpen(false);
            setEditingBooker(null);
            setPrefillData(null);
            queryClient.invalidateQueries({ queryKey: ['/api/all-booker-links'] });
            queryClient.invalidateQueries({ queryKey: ['/api/regular-bookers/suggestions'] });
          } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to save", variant: "destructive" });
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <Dialog open={!!createdPortalUrl} onOpenChange={(v) => { if (!v) setCreatedPortalUrl(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Regular Booker Created
            </DialogTitle>
            <DialogDescription>
              A unique portal link has been generated and copied to your clipboard. Share this link with the booker so they can access their portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
              <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <code className="flex-1 text-xs break-all select-all" data-testid="text-created-portal-url">{createdPortalUrl}</code>
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-copy-created-portal-url"
                onClick={() => {
                  if (createdPortalUrl) {
                    navigator.clipboard.writeText(createdPortalUrl).then(() => {
                      toast({ title: "Link copied" });
                    });
                  }
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedPortalUrl(null)} data-testid="button-dismiss-portal-url">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegularBookerFormDialog({
  open,
  onOpenChange,
  booker,
  contacts,
  groups,
  onSubmit,
  isPending,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booker: RegularBooker | null;
  contacts: Contact[];
  groups: Group[];
  onSubmit: (data: any) => Promise<void>;
  isPending: boolean;
  prefill?: { contactId?: number; groupId?: number; billingEmail?: string; organizationName?: string } | null;
}) {
  const [contactId, setContactId] = useState<number | null>(booker?.contactId || null);
  const [groupId, setGroupId] = useState<number | null>(booker?.groupId || null);
  const [bookerSearch, setBookerSearch] = useState("");
  const [organizationName, setOrganizationName] = useState(booker?.organizationName || "");
  const [billingEmail, setBillingEmail] = useState(booker?.billingEmail || "");
  const [billingAddress, setBillingAddress] = useState(booker?.billingAddress || "");
  const [billingPhone, setBillingPhone] = useState(booker?.billingPhone || "");
  const [pricingTier, setPricingTier] = useState(booker?.pricingTier || "full_price");
  const [discountPercentage, setDiscountPercentage] = useState(booker?.discountPercentage || "0");
  const [kohaMouNotes, setKohaMouNotes] = useState(booker?.kohaMouNotes || "");
  const [hasBookingPackage, setHasBookingPackage] = useState(booker?.hasBookingPackage || false);
  const [packageTotalBookings, setPackageTotalBookings] = useState(booker?.packageTotalBookings?.toString() || "0");
  const [packageUsedBookings, setPackageUsedBookings] = useState(booker?.packageUsedBookings?.toString() || "0");
  const [packageExpiresAt, setPackageExpiresAt] = useState(
    booker?.packageExpiresAt ? format(new Date(booker.packageExpiresAt), "yyyy-MM-dd") : ""
  );
  const [accountStatus, setAccountStatus] = useState(booker?.accountStatus || "active");
  const [paymentTerms, setPaymentTerms] = useState(booker?.paymentTerms || "immediate");
  const [notes, setNotes] = useState(booker?.notes || "");
  const [usualBookingNeeds, setUsualBookingNeeds] = useState(booker?.usualBookingNeeds || "");
  const [linkedMembershipId, setLinkedMembershipId] = useState<number | null>(booker?.membershipId || null);
  const [linkedMouId, setLinkedMouId] = useState<number | null>(booker?.mouId || null);

  const { data: allMemberships } = useMemberships();
  const { data: allMous } = useMous();
  const { data: allBookings } = useBookings();
  const activeMemberships = useMemo(() => (allMemberships || []).filter(m => m.status === "active"), [allMemberships]);
  const activeMous = useMemo(() => (allMous || []).filter(m => m.status === "active"), [allMous]);

  const linkedMembership = useMemo(() => allMemberships?.find(m => m.id === linkedMembershipId), [allMemberships, linkedMembershipId]);
  const linkedMou = useMemo(() => allMous?.find(m => m.id === linkedMouId), [allMous, linkedMouId]);
  const hasLinkedAgreement = !!(linkedMembershipId || linkedMouId);

  const agreementUsage = useMemo(() => {
    if (!hasLinkedAgreement) return null;
    const agreement = linkedMembership || linkedMou;
    if (!agreement) return null;
    const allowance = (agreement as any).bookingAllowance;
    const period = (agreement as any).allowancePeriod || "quarterly";
    if (!allowance) return null;
    const type = linkedMembershipId ? "membership" as const : "mou" as const;
    const id = (linkedMembershipId || linkedMouId)!;
    const used = getAgreementAllowanceUsage(allBookings, type, id, period);
    const remaining = Math.max(0, allowance - used);
    const periodLabel = getPeriodLabel(period);
    return { allowance, used, remaining, period, periodLabel };
  }, [hasLinkedAgreement, linkedMembership, linkedMou, linkedMembershipId, linkedMouId, allBookings]);

  useEffect(() => {
    if (booker) {
      setContactId(booker.contactId || null);
      setGroupId(booker.groupId || null);
      setOrganizationName(booker.organizationName || "");
      setBillingEmail(booker.billingEmail || "");
      setBillingAddress(booker.billingAddress || "");
      setBillingPhone(booker.billingPhone || "");
      setPricingTier(booker.pricingTier || "full_price");
      setDiscountPercentage(booker.discountPercentage || "0");
      setKohaMouNotes(booker.kohaMouNotes || "");
      setHasBookingPackage(booker.hasBookingPackage || false);
      setPackageTotalBookings(booker.packageTotalBookings?.toString() || "0");
      setPackageUsedBookings(booker.packageUsedBookings?.toString() || "0");
      setPackageExpiresAt(booker.packageExpiresAt ? format(new Date(booker.packageExpiresAt), "yyyy-MM-dd") : "");
      setAccountStatus(booker.accountStatus || "active");
      setPaymentTerms(booker.paymentTerms || "immediate");
      setNotes(booker.notes || "");
      setUsualBookingNeeds(booker.usualBookingNeeds || "");
      setLinkedMembershipId(booker.membershipId || null);
      setLinkedMouId(booker.mouId || null);
    } else {
      setContactId(prefill?.contactId || null);
      setGroupId(prefill?.groupId || null);
      setOrganizationName(prefill?.organizationName || "");
      setBillingEmail(prefill?.billingEmail || "");
      setBillingAddress("");
      setBillingPhone("");
      setPricingTier("full_price");
      setDiscountPercentage("0");
      setKohaMouNotes("");
      setHasBookingPackage(false);
      setPackageTotalBookings("0");
      setPackageUsedBookings("0");
      setPackageExpiresAt("");
      setAccountStatus("active");
      setPaymentTerms("immediate");
      setNotes("");
      setUsualBookingNeeds("");
      setLinkedMembershipId(null);
      setLinkedMouId(null);
    }
    setBookerSearch("");
  }, [booker, prefill]);

  const searchResults = useMemo(() => {
    if (!bookerSearch.trim()) return [];
    const term = bookerSearch.toLowerCase();
    const people = contacts.filter(c => c.name.toLowerCase().includes(term)).slice(0, 5).map(c => ({
      id: c.id,
      name: c.name,
      detail: c.email || "",
      type: "person" as const,
      data: c,
    }));
    const grps = groups.filter(g => g.name.toLowerCase().includes(term)).slice(0, 5).map(g => ({
      id: g.id,
      name: g.name,
      detail: g.type || "Organisation",
      type: "group" as const,
      data: g,
    }));
    return [...people, ...grps].slice(0, 8);
  }, [contacts, groups, bookerSearch]);

  const selectBookerResult = (item: { id: number; type: "person" | "group"; data: any }) => {
    if (item.type === "person") {
      setContactId(item.id);
      const c = item.data;
      if (!billingEmail && c.email) setBillingEmail(c.email);
      if (!billingPhone && c.phone) setBillingPhone(c.phone);
    } else {
      setGroupId(item.id);
      const g = item.data;
      if (!organizationName) setOrganizationName(g.name || "");
      if (!billingEmail && g.contactEmail) setBillingEmail(g.contactEmail);
      if (!billingPhone && g.contactPhone) setBillingPhone(g.contactPhone);
      if (!billingAddress && g.address) setBillingAddress(g.address);
    }
    setBookerSearch("");
  };

  const handleSubmit = () => {
    if (!hasLinkedAgreement && !billingEmail.trim()) return;
    if (!contactId && !groupId) return;
    const resolvedBillingEmail = billingEmail.trim() || 
      (selectedContact?.email || "") || 
      (selectedGroup as any)?.contactEmail || "";
    onSubmit({
      contactId: contactId || null,
      groupId: groupId || null,
      organizationName: organizationName.trim() || null,
      billingEmail: resolvedBillingEmail,
      billingAddress: billingAddress.trim() || null,
      billingPhone: billingPhone.trim() || null,
      pricingTier,
      discountPercentage: pricingTier === "discounted" ? discountPercentage : "0",
      kohaMouNotes: pricingTier === "free_koha" ? kohaMouNotes.trim() : null,
      hasBookingPackage,
      packageTotalBookings: hasBookingPackage ? parseInt(packageTotalBookings) || 0 : 0,
      packageUsedBookings: hasBookingPackage ? parseInt(packageUsedBookings) || 0 : 0,
      packageExpiresAt: hasBookingPackage && packageExpiresAt ? new Date(packageExpiresAt).toISOString() : null,
      membershipId: linkedMembershipId || null,
      mouId: linkedMouId || null,
      loginEmail: null,
      accountStatus,
      paymentTerms,
      notes: notes.trim() || null,
      usualBookingNeeds: usualBookingNeeds.trim() || null,
    });
  };

  const selectedContact = contactId ? contacts.find(c => c.id === contactId) : null;
  const selectedGroup = groupId ? groups.find(g => g.id === groupId) : null;
  const hasBookerSelection = !!(contactId || groupId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-booker-form-title">
            {booker ? "Edit Regular Booker" : "Add Regular Booker"}
          </DialogTitle>
          <DialogDescription>
            {booker ? "Update regular booker details." : "Set up a new regular booker with pricing and billing details. A portal link will be generated automatically."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Booker *</Label>
            <p className="text-xs text-muted-foreground">Search for a person or group</p>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedContact && (
                <Badge variant="secondary" className="text-xs gap-1 pr-1" data-testid="badge-selected-booker-person">
                  <Users className="w-3 h-3 mr-0.5" />
                  {selectedContact.name}
                  <button onClick={() => setContactId(null)} className="ml-0.5" type="button">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedGroup && (
                <Badge variant="outline" className="text-xs gap-1 pr-1" data-testid="badge-selected-booker-group">
                  <Building className="w-3 h-3 mr-0.5" />
                  {selectedGroup.name}
                  <button onClick={() => setGroupId(null)} className="ml-0.5" type="button">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={bookerSearch}
                onChange={(e) => setBookerSearch(e.target.value)}
                placeholder="Search people or groups..."
                className="pl-7"
                data-testid="input-search-booker"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="border border-border rounded-md divide-y divide-border/50 max-h-[180px] overflow-y-auto">
                {searchResults.map(item => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => selectBookerResult(item)}
                    className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-muted/50"
                    type="button"
                    data-testid={`button-select-booker-${item.type}-${item.id}`}
                  >
                    <span className="flex items-center gap-1.5">
                      {item.type === "person" ? <Users className="w-3 h-3 text-muted-foreground" /> : <Building className="w-3 h-3 text-muted-foreground" />}
                      {item.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{item.detail}</span>
                      <Badge variant={item.type === "person" ? "secondary" : "outline"} className="text-[9px] px-1">
                        {item.type === "person" ? "Person" : "Group"}
                      </Badge>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Organisation Name</Label>
            <Input
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g. Tamaki Community Trust"
              data-testid="input-booker-org-name"
            />
          </div>

          {(activeMemberships.length > 0 || activeMous.length > 0) && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold">Linked Agreement</Label>
              <p className="text-xs text-muted-foreground">Link to a membership or MOU to auto-manage pricing and booking allowances.</p>
              <div className="grid grid-cols-2 gap-3">
                {activeMemberships.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Membership</Label>
                    <Select
                      value={linkedMembershipId?.toString() || "none"}
                      onValueChange={(v) => {
                        setLinkedMembershipId(v === "none" ? null : parseInt(v));
                        if (v !== "none") setLinkedMouId(null);
                      }}
                    >
                      <SelectTrigger data-testid="select-booker-membership">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {activeMemberships.map((m) => (
                          <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {activeMous.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">MOU</Label>
                    <Select
                      value={linkedMouId?.toString() || "none"}
                      onValueChange={(v) => {
                        setLinkedMouId(v === "none" ? null : parseInt(v));
                        if (v !== "none") setLinkedMembershipId(null);
                      }}
                    >
                      <SelectTrigger data-testid="select-booker-mou">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {activeMous.map((m) => (
                          <SelectItem key={m.id} value={m.id.toString()}>{m.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {agreementUsage && (
                <div className="bg-muted/50 rounded-md p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Venue Hire Allowance</span>
                    <span className="font-medium">{agreementUsage.used}/{agreementUsage.allowance} used ({agreementUsage.remaining} remaining)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Period</span>
                    <span>{agreementUsage.periodLabel}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasLinkedAgreement && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Billing Email</Label>
                  <Input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="billing@example.com"
                    data-testid="input-booker-billing-email"
                  />
                </div>
                <div>
                  <Label>Billing Phone</Label>
                  <Input
                    value={billingPhone}
                    onChange={(e) => setBillingPhone(e.target.value)}
                    placeholder="Phone number"
                    data-testid="input-booker-billing-phone"
                  />
                </div>
              </div>

              <div>
                <Label>Billing Address</Label>
                <Textarea
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Full billing address"
                  className="resize-none"
                  data-testid="input-booker-billing-address"
                />
              </div>
            </>
          )}

          <div>
            <Label>Account Status</Label>
            <Select value={accountStatus} onValueChange={setAccountStatus}>
              <SelectTrigger data-testid="select-booker-account-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGULAR_BOOKER_STATUSES.map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!hasLinkedAgreement && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold">Pricing and Packages</Label>
              <p className="text-xs text-muted-foreground">Set pricing manually when no agreement is linked.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Pricing Tier</Label>
                  <Select value={pricingTier} onValueChange={setPricingTier}>
                    <SelectTrigger data-testid="select-booker-pricing-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICING_TIERS.map(t => (
                        <SelectItem key={t} value={t}>{PRICING_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger data-testid="select-booker-payment-terms">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map(t => (
                        <SelectItem key={t} value={t}>{PAYMENT_TERM_LABELS[t] || t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {pricingTier === "discounted" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    data-testid="input-booker-discount"
                  />
                </div>
              )}
              {pricingTier === "free_koha" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Koha / MOU Notes</Label>
                  <Textarea
                    value={kohaMouNotes}
                    onChange={(e) => setKohaMouNotes(e.target.value)}
                    placeholder="Details about koha arrangement..."
                    className="resize-none"
                    data-testid="input-booker-koha-notes"
                  />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Prepaid Venue Hire Package</Label>
                  <Switch
                    checked={hasBookingPackage}
                    onCheckedChange={setHasBookingPackage}
                    data-testid="switch-booker-package"
                  />
                </div>
                {hasBookingPackage && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Venue Hires</Label>
                        <Input
                          type="number"
                          min="0"
                          value={packageTotalBookings}
                          onChange={(e) => setPackageTotalBookings(e.target.value)}
                          data-testid="input-booker-package-total"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Used Venue Hires</Label>
                        <Input
                          type="number"
                          min="0"
                          value={packageUsedBookings}
                          onChange={(e) => setPackageUsedBookings(e.target.value)}
                          data-testid="input-booker-package-used"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Package Expires</Label>
                      <Input
                        type="date"
                        value={packageExpiresAt}
                        onChange={(e) => setPackageExpiresAt(e.target.value)}
                        data-testid="input-booker-package-expires"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {hasLinkedAgreement && (
            <div>
              <Label>Payment Terms</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger data-testid="select-booker-payment-terms">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map(t => (
                    <SelectItem key={t} value={t}>{PAYMENT_TERM_LABELS[t] || t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Usual Venue Hire Needs</Label>
            <Textarea
              value={usualBookingNeeds}
              onChange={(e) => setUsualBookingNeeds(e.target.value)}
              placeholder="e.g. Weekly rehearsal space, monthly meetings..."
              className="resize-none"
              data-testid="input-booker-usual-needs"
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              className="resize-none"
              data-testid="input-booker-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-booker-form">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !hasBookerSelection || (!hasLinkedAgreement && !billingEmail.trim())}
            data-testid="button-save-regular-booker"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {booker ? "Save Changes" : "Add Booker"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
