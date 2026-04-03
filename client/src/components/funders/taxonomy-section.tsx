import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  MoreVertical,
  Target,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FunderTaxCategory {
  id: number;
  funderId: number;
  name: string;
  description: string | null;
  color: string | null;
  keywords: string[] | null;
  rules: Record<string, any> | null;
  sortOrder: number | null;
  active: boolean | null;
}

interface FunderTaxMapping {
  id: number;
  funderCategoryId: number;
  genericTaxonomyId: number;
  confidenceModifier: number | null;
}

export function FunderTaxonomySection({ funderId }: { funderId: number }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingCat, setEditingCat] = useState<FunderTaxCategory | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [newKeywords, setNewKeywords] = useState("");
  const [isReclassifying, setIsReclassifying] = useState(false);

  const { data: categories = [], isLoading } = useQuery<FunderTaxCategory[]>({
    queryKey: ["/api/funders", funderId, "taxonomy"],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funderId}/taxonomy`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load taxonomy");
      return res.json();
    },
  });

  const { data: mappings = [] } = useQuery<FunderTaxMapping[]>({
    queryKey: ["/api/funders", funderId, "taxonomy-mappings"],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funderId}/taxonomy-mappings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load mappings");
      return res.json();
    },
  });

  const { data: genericTaxonomy = [] } = useQuery<any[]>({
    queryKey: ["/api/taxonomy"],
    queryFn: async () => {
      const res = await fetch("/api/taxonomy", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load taxonomy");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/funders/${funderId}/taxonomy`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy"] });
      setShowAdd(false);
      setNewName("");
      setNewDescription("");
      setNewKeywords("");
      toast({ title: "Category created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/funders/${funderId}/taxonomy/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy"] });
      setEditingCat(null);
      toast({ title: "Category updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/funders/${funderId}/taxonomy/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy-mappings"] });
      toast({ title: "Category deleted" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const createMappingMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/funders/${funderId}/taxonomy-mappings`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy-mappings"] });
      toast({ title: "Mapping added" });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/funders/${funderId}/taxonomy-mappings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funders", funderId, "taxonomy-mappings"] });
    },
  });

  const handleReclassify = async () => {
    setIsReclassifying(true);
    try {
      const res = await fetch(`/api/funders/${funderId}/reclassify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      toast({ title: "Reclassification complete", description: `${result.processed} processed, ${result.classified} classified` });
    } catch (e: any) {
      toast({ title: "Reclassification failed", description: e.message, variant: "destructive" });
    } finally {
      setIsReclassifying(false);
    }
  };

  const COLORS: Record<string, string> = {
    purple: "bg-purple-100 text-purple-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    pink: "bg-pink-100 text-pink-800",
    teal: "bg-teal-100 text-teal-800",
    orange: "bg-orange-100 text-orange-800",
    cyan: "bg-cyan-100 text-cyan-800",
    indigo: "bg-indigo-100 text-indigo-800",
  };

  const getMappingsForCategory = (catId: number) =>
    mappings.filter((m) => m.funderCategoryId === catId);

  const getGenericName = (taxonomyId: number) =>
    genericTaxonomy.find((t: any) => t.id === taxonomyId)?.name || `#${taxonomyId}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium">Taxonomy Lens</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            How this funder sees impact — auto-classifies tracked data through their lens
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReclassify}
            disabled={isReclassifying || categories.length === 0}
          >
            {isReclassifying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Reclassify
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Category
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : categories.length === 0 ? (
        <Card className="p-6 text-center border-dashed">
          <Target className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No taxonomy categories set up for this funder</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add categories to define how this funder sees your impact, or seed defaults
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add First Category
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => {
            const catMappings = getMappingsForCategory(cat.id);
            return (
              <Card key={cat.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={COLORS[cat.color || "blue"] || COLORS.blue}>
                        {cat.name}
                      </Badge>
                      {!cat.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                    )}
                    {(cat.keywords?.length ?? 0) > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {(cat.keywords || []).slice(0, 5).map((kw) => (
                          <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">{kw}</span>
                        ))}
                        {(cat.keywords?.length ?? 0) > 5 && (
                          <span className="text-[10px] text-muted-foreground">+{(cat.keywords?.length ?? 0) - 5} more</span>
                        )}
                      </div>
                    )}
                    {catMappings.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap items-center">
                        <span className="text-[10px] text-muted-foreground">Inherits:</span>
                        {catMappings.map((m) => (
                          <span key={m.id} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded cursor-pointer hover:bg-red-50 hover:text-red-700"
                            onClick={() => deleteMappingMutation.mutate(m.id)}
                            title="Click to remove mapping"
                          >
                            {getGenericName(m.genericTaxonomyId)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingCat(cat);
                        setNewName(cat.name);
                        setNewDescription(cat.description || "");
                        setNewColor(cat.color || "blue");
                        setNewKeywords((cat.keywords || []).join(", "));
                      }}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateMutation.mutate({ id: cat.id, active: !cat.active })}>
                        {cat.active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      {genericTaxonomy.filter((g: any) => !catMappings.some((m) => m.genericTaxonomyId === g.id)).length > 0 && (
                        <DropdownMenuItem onClick={() => {
                          const unmapped = genericTaxonomy.filter((g: any) => !catMappings.some((m) => m.genericTaxonomyId === g.id));
                          if (unmapped.length > 0) {
                            const name = prompt(`Map from generic category:\n${unmapped.map((g: any) => g.name).join("\n")}\n\nType category name:`);
                            const match = unmapped.find((g: any) => g.name.toLowerCase() === (name || "").toLowerCase());
                            if (match) {
                              createMappingMutation.mutate({ funderCategoryId: cat.id, genericTaxonomyId: match.id });
                            }
                          }
                        }}>
                          <ArrowRight className="w-4 h-4 mr-2" /> Add Mapping
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => { if (confirm(`Delete "${cat.name}"?`)) deleteMutation.mutate(cat.id); }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={showAdd || !!editingCat} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditingCat(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit Category" : "Add Taxonomy Category"}</DialogTitle>
            <DialogDescription>
              Define how this funder sees a specific type of impact
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Inclusive Economic Growth" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="What this category means to the funder" rows={2} />
            </div>
            <div>
              <Label>Color</Label>
              <Select value={newColor} onValueChange={setNewColor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(COLORS).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Keywords (comma-separated)</Label>
              <Textarea value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="enterprise, revenue, first sale, business growth" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditingCat(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                const keywords = newKeywords.split(",").map((k) => k.trim()).filter(Boolean);
                if (editingCat) {
                  updateMutation.mutate({ id: editingCat.id, name: newName, description: newDescription, color: newColor, keywords });
                } else {
                  createMutation.mutate({ name: newName, description: newDescription, color: newColor, keywords });
                }
              }}
              disabled={!newName.trim()}
            >
              {editingCat ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
