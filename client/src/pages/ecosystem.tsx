import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  AlertTriangle, Star, Users, Building2, BookOpen, Layers, Clock,
  ArrowUpRight, ArrowDownRight, Network, RefreshCw, ChevronDown,
  Activity,
} from "lucide-react";
import type { VipItem } from "@/components/community/ecosystem-views";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type NeedsAttentionItem = {
  id: number;
  name: string;
  type?: "contact" | "group";
  connectionStrength: string;
  isVip: boolean;
  email?: string | null;
  linkedGroupId?: number | null;
  groupType?: string;
  lastTouchpoint: string | null;
  daysSince: number | null;
};

type EcosystemReach = {
  maoriLedTrusted: number;
  servesMaoriTrusted: number;
  maoriLedTotal: number;
  servesMaoriTotal: number;
  connectedTotal: number;
  totalOrgs: number;
  wovenTotal: number;
  trustedTotal: number;
  connectionMovements: { deepened: number; declined: number };
};

type GroupHealth = {
  total: number;
  active: number;
  dormant: number;
  atRisk: number;
};

type RecalcSummary = {
  contactsProcessed: number;
  groupsProcessed: number;
  contactsUpdated: number;
  groupsUpdated: number;
};

const DEPTH_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  access: { icon: Building2, label: "Access", color: "text-orange-600" },
  capability: { icon: BookOpen, label: "Capability", color: "text-blue-600" },
  both: { icon: Layers, label: "Both", color: "text-purple-600" },
  past: { icon: Clock, label: "Past", color: "text-muted-foreground" },
};

export default function EcosystemPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [wovenExpanded, setWovenExpanded] = useState(false);

  const { data: contactsNeedAttention, isLoading: loadingAttention } = useQuery<NeedsAttentionItem[]>({
    queryKey: ["/api/contacts/needs-attention"],
  });

  const { data: groupsNeedAttention } = useQuery<NeedsAttentionItem[]>({
    queryKey: ["/api/groups/needs-attention"],
  });

  const { data: vipItems } = useQuery<VipItem[]>({
    queryKey: ["/api/ecosystem/vip"],
  });

  const { data: reach } = useQuery<EcosystemReach>({
    queryKey: ["/api/ecosystem/reach"],
  });

  const { data: groupHealth } = useQuery<GroupHealth>({
    queryKey: ["/api/groups/ecosystem-health"],
  });

  const { data: deliveryDepths } = useQuery<Record<number, { depth: string; active: boolean }>>({
    queryKey: ["/api/contacts/delivery-depth"],
  });

  const { data: contacts } = useQuery<any[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: groups } = useQuery<any[]>({
    queryKey: ["/api/groups"],
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/community/connection-strength/recalc", { method: "POST" });
      if (!res.ok) throw new Error("Recalc failed");
      return res.json() as Promise<RecalcSummary>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecosystem/reach"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/ecosystem-health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/needs-attention"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/needs-attention"] });
      toast({
        title: "Connection strengths recalculated",
        description: `${data.contactsUpdated} contacts, ${data.groupsUpdated} groups updated`,
      });
    },
    onError: () => {
      toast({ title: "Recalculation failed", variant: "destructive" });
    },
  });

  // Merge contact + group needs-attention items
  const needsAttention: NeedsAttentionItem[] = [
    ...(contactsNeedAttention || []).map(c => ({ ...c, type: "contact" as const })),
    ...(groupsNeedAttention || []).map(g => ({ ...g, type: "group" as const })),
  ].sort((a, b) => (a.daysSince ?? 999) - (b.daysSince ?? 999)).reverse();

  // Woven contacts + groups
  const wovenContacts = (contacts || []).filter(
    (c: any) => c.connectionStrength === "woven" && !c.isArchived
  ).map((c: any) => ({ ...c, entityType: "contact" as const }));

  const wovenGroups = (groups || []).filter(
    (g: any) => g.connectionStrength === "woven" && g.active !== false
  ).map((g: any) => ({ ...g, entityType: "group" as const }));

  const allWoven = [...wovenContacts, ...wovenGroups];
  const WOVEN_LIMIT = 15;
  const wovenToShow = wovenExpanded ? allWoven : allWoven.slice(0, WOVEN_LIMIT);

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/community/people" className="hover:text-foreground">Community</Link>
              <span>›</span>
              <span>Ecosystem</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Ecosystem Health</h1>
            <p className="text-muted-foreground mt-1">Relationship health, VIP status, and ecosystem reach</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalcMutation.mutate()}
            disabled={recalcMutation.isPending}
            className="shrink-0"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${recalcMutation.isPending ? "animate-spin" : ""}`} />
            Recalculate
          </Button>
        </div>

        {/* Group Health Summary */}
        {groupHealth && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-500" />
              Organisation Health
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <p className="text-2xl font-bold">{groupHealth.total}</p>
                <p className="text-xs text-muted-foreground">Total orgs</p>
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold text-green-600">{groupHealth.active}</p>
                <p className="text-xs text-muted-foreground">Active (90 days)</p>
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold text-muted-foreground">{groupHealth.dormant}</p>
                <p className="text-xs text-muted-foreground">Dormant (180+ days)</p>
              </Card>
              <Card className="p-4">
                <p className={`text-2xl font-bold ${groupHealth.atRisk > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                  {groupHealth.atRisk}
                </p>
                <p className="text-xs text-muted-foreground">At risk</p>
              </Card>
            </div>
          </section>
        )}

        {/* Needs Attention */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Needs Attention
          </h2>
          {loadingAttention ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !needsAttention.length ? (
            <Card className="p-6 text-center text-muted-foreground">
              All trusted and woven relationships have recent touchpoints.
            </Card>
          ) : (
            <div className="grid gap-2">
              {needsAttention.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.type === "group" ? `/community/groups?group=${item.id}` : `/contacts/${item.id}`}
                >
                  <Card className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${item.connectionStrength === "woven" ? "bg-purple-500" : "bg-green-500"}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.name}</span>
                            {item.isVip && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />}
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {item.type === "group" ? "Org" : "Person"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground capitalize">{item.connectionStrength}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-sm font-medium ${(item.daysSince || 999) > 90 ? "text-red-500" : "text-amber-500"}`}>
                          {item.daysSince ? `${item.daysSince}d ago` : "Never"}
                        </span>
                        <p className="text-xs text-muted-foreground">Last touchpoint</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* VIP */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            VIP — Must Believe In Us
          </h2>
          {!vipItems?.length ? (
            <Card className="p-6 text-center text-muted-foreground">No VIP contacts or groups flagged.</Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {vipItems.map((item) => (
                <Link key={`${item.type}-${item.id}`} href={item.type === "contact" ? `/contacts/${item.id}` : `/community/groups?group=${item.id}`}>
                  <Card className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                          <span className="font-medium truncate">{item.name}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {item.type === "contact" ? "Person" : "Org"}
                          </Badge>
                        </div>
                        {item.vipReason && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.vipReason}</p>
                        )}
                      </div>
                      {item.type === "contact" && item.role && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">{item.role}</Badge>
                      )}
                      {item.type === "group" && item.groupType && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">{item.groupType}</Badge>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Strongest Relationships */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Network className="w-5 h-5 text-purple-500" />
            Woven — Strongest Relationships ({allWoven.length})
          </h2>
          {!allWoven.length ? (
            <Card className="p-6 text-center text-muted-foreground">No contacts or groups at Woven connection level yet.</Card>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {wovenToShow.map((item: any) => {
                  const isContact = item.entityType === "contact";
                  const dd = isContact ? deliveryDepths?.[item.id] : null;
                  const depthCfg = dd?.depth && dd.depth !== "none" ? DEPTH_CONFIG[dd.depth] : null;
                  const DepthIcon = depthCfg?.icon;
                  return (
                    <Link
                      key={`${item.entityType}-${item.id}`}
                      href={isContact ? `/contacts/${item.id}` : `/community/groups?group=${item.id}`}
                    >
                      <Card className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{item.name}</span>
                                {item.isVip && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                                {!isContact && (
                                  <Badge variant="outline" className="text-[10px] shrink-0">Org</Badge>
                                )}
                              </div>
                              {isContact && item.businessName && (
                                <span className="text-xs text-muted-foreground">{item.businessName}</span>
                              )}
                              {!isContact && item.type && (
                                <span className="text-xs text-muted-foreground">{item.type}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {depthCfg && DepthIcon && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`inline-flex items-center gap-1 text-xs ${depthCfg.color}`}>
                                    <DepthIcon className="w-3.5 h-3.5" />
                                    <span>{depthCfg.label}</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Delivery: {depthCfg.label}</p></TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
              {allWoven.length > WOVEN_LIMIT && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setWovenExpanded(!wovenExpanded)}
                >
                  <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${wovenExpanded ? "rotate-180" : ""}`} />
                  {wovenExpanded ? "Show less" : `Show all ${allWoven.length}`}
                </Button>
              )}
            </>
          )}
        </section>

        {/* Ecosystem Reach */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-500" />
            Ecosystem Reach
          </h2>
          {reach ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <p className="text-2xl font-bold">{reach.maoriLedTotal}</p>
                <p className="text-xs text-muted-foreground">Maori-led orgs</p>
                {reach.maoriLedTrusted > 0 && (
                  <p className="text-xs text-green-600 mt-1">{reach.maoriLedTrusted} trusted or woven</p>
                )}
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold">{reach.servesMaoriTotal}</p>
                <p className="text-xs text-muted-foreground">Serves Maori</p>
                {reach.servesMaoriTrusted > 0 && (
                  <p className="text-xs text-green-600 mt-1">{reach.servesMaoriTrusted} trusted or woven</p>
                )}
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold">{reach.connectedTotal}</p>
                <p className="text-xs text-muted-foreground">Connected+ orgs</p>
                <p className="text-xs text-muted-foreground mt-1">{reach.wovenTotal} woven · {reach.trustedTotal} trusted</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  {reach.connectionMovements.deepened > 0 && (
                    <div className="flex items-center gap-1">
                      <ArrowUpRight className="w-4 h-4 text-green-500" />
                      <span className="text-lg font-bold text-green-600">{reach.connectionMovements.deepened}</span>
                    </div>
                  )}
                  {reach.connectionMovements.declined > 0 && (
                    <div className="flex items-center gap-1">
                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                      <span className="text-lg font-bold text-red-600">{reach.connectionMovements.declined}</span>
                    </div>
                  )}
                  {reach.connectionMovements.deepened === 0 && reach.connectionMovements.declined === 0 && (
                    <span className="text-lg font-bold text-muted-foreground">—</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Connection movements this quarter</p>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading reach data...</p>
          )}
        </section>
      </div>
    </main>
  );
}
