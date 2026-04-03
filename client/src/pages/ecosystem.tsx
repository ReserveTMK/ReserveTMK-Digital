import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  AlertTriangle, Star, Users, Building2, BookOpen, Layers, Clock,
  ArrowUpRight, ArrowDownRight, Network,
} from "lucide-react";
import { formatRelativeDate } from "@/components/community/ecosystem-views";
import type { VipItem } from "@/components/community/ecosystem-views";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type NeedsAttentionItem = {
  id: number;
  name: string;
  connectionStrength: string;
  isVip: boolean;
  email: string | null;
  linkedGroupId: number | null;
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
  connectionMovements: { deepened: number; declined: number };
};

const DEPTH_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  access: { icon: Building2, label: "Access", color: "text-orange-600" },
  capability: { icon: BookOpen, label: "Capability", color: "text-blue-600" },
  both: { icon: Layers, label: "Both", color: "text-purple-600" },
  past: { icon: Clock, label: "Past", color: "text-muted-foreground" },
};

export default function EcosystemPage() {
  const { data: needsAttention, isLoading: loadingAttention } = useQuery<NeedsAttentionItem[]>({
    queryKey: ["/api/contacts/needs-attention"],
  });

  const { data: vipItems } = useQuery<VipItem[]>({
    queryKey: ["/api/ecosystem/vip"],
  });

  const { data: reach } = useQuery<EcosystemReach>({
    queryKey: ["/api/ecosystem/reach"],
  });

  const { data: deliveryDepths } = useQuery<Record<number, { depth: string; active: boolean }>>({
    queryKey: ["/api/contacts/delivery-depth"],
  });

  const { data: contacts } = useQuery<any[]>({
    queryKey: ["/api/contacts"],
  });

  const wovenContacts = (contacts || []).filter(
    (c: any) => c.connectionStrength === "woven" && !c.isArchived
  );

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/community/people" className="hover:text-foreground">Community</Link>
            <span>›</span>
            <span>Ecosystem</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Ecosystem Health</h1>
          <p className="text-muted-foreground mt-1">Relationship health, VIP status, and ecosystem reach</p>
        </div>

        {/* Needs Attention */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Needs Attention
          </h2>
          {loadingAttention ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !needsAttention?.length ? (
            <Card className="p-6 text-center text-muted-foreground">
              All trusted and woven relationships have recent touchpoints.
            </Card>
          ) : (
            <div className="grid gap-2">
              {needsAttention.map((item) => (
                <Link key={item.id} href={`/contacts/${item.id}`}>
                  <Card className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${item.connectionStrength === "woven" ? "bg-purple-500" : "bg-green-500"}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.name}</span>
                            {item.isVip && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />}
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
            Woven — Strongest Relationships ({wovenContacts.length})
          </h2>
          {!wovenContacts.length ? (
            <Card className="p-6 text-center text-muted-foreground">No contacts at Woven connection level yet.</Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {wovenContacts.map((contact: any) => {
                const dd = deliveryDepths?.[contact.id];
                const depthCfg = dd?.depth && dd.depth !== "none" ? DEPTH_CONFIG[dd.depth] : null;
                const DepthIcon = depthCfg?.icon;
                return (
                  <Link key={contact.id} href={`/contacts/${contact.id}`}>
                    <Card className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{contact.name}</span>
                              {contact.isVip && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                            </div>
                            {contact.businessName && (
                              <span className="text-xs text-muted-foreground">{contact.businessName}</span>
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
                <p className="text-xs text-muted-foreground">Māori-led orgs</p>
                {reach.maoriLedTrusted > 0 && (
                  <p className="text-xs text-green-600 mt-1">{reach.maoriLedTrusted} in our community</p>
                )}
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold">{reach.servesMaoriTotal}</p>
                <p className="text-xs text-muted-foreground">Serves Māori</p>
                {reach.servesMaoriTrusted > 0 && (
                  <p className="text-xs text-green-600 mt-1">{reach.servesMaoriTrusted} in our community</p>
                )}
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold">{reach.connectedTotal}</p>
                <p className="text-xs text-muted-foreground">Connected orgs</p>
                <p className="text-xs text-muted-foreground mt-1">of {reach.totalOrgs} total</p>
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
