import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/beautiful-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, X, Check, BookOpen, Tags, Scan, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  useTaxonomy,
  useCreateTaxonomy,
  useUpdateTaxonomy,
  useDeleteTaxonomy,
  useKeywords,
  useCreateKeyword,
  useDeleteKeyword,
} from "@/hooks/use-taxonomy";

interface CategorySuggestion {
  name: string;
  description: string;
  color: string;
  confidence: number;
  evidence: string;
}

interface KeywordSuggestion {
  phrase: string;
  suggestedCategory: string;
  confidence: number;
  evidence: string;
}

interface ScanResult {
  categorySuggestions: CategorySuggestion[];
  keywordSuggestions: KeywordSuggestion[];
  scannedReports: number;
  scannedInteractions: number;
}

const COLOR_OPTIONS = [
  { value: "purple", bg: "bg-purple-500", ring: "ring-purple-200" },
  { value: "blue", bg: "bg-blue-500", ring: "ring-blue-200" },
  { value: "green", bg: "bg-green-500", ring: "ring-green-200" },
  { value: "amber", bg: "bg-amber-500", ring: "ring-amber-200" },
  { value: "red", bg: "bg-red-500", ring: "ring-red-200" },
  { value: "pink", bg: "bg-pink-500", ring: "ring-pink-200" },
  { value: "teal", bg: "bg-teal-500", ring: "ring-teal-200" },
  { value: "orange", bg: "bg-orange-500", ring: "ring-orange-200" },
  { value: "cyan", bg: "bg-cyan-500", ring: "ring-cyan-200" },
  { value: "indigo", bg: "bg-indigo-500", ring: "ring-indigo-200" },
];

function getColorClasses(color: string | null | undefined) {
  return COLOR_OPTIONS.find((c) => c.value === color) || COLOR_OPTIONS[0];
}

export default function Taxonomy() {
  const { toast } = useToast();
  const { data: taxonomyItems = [], isLoading: taxonomyLoading } = useTaxonomy();
  const { data: keywords = [], isLoading: keywordsLoading } = useKeywords();

  const createTaxonomy = useCreateTaxonomy();
  const updateTaxonomy = useUpdateTaxonomy();
  const deleteTaxonomy = useDeleteTaxonomy();
  const createKeyword = useCreateKeyword();
  const deleteKeyword = useDeleteKeyword();

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryColor, setCategoryColor] = useState("purple");

  const [showKeywordForm, setShowKeywordForm] = useState(false);
  const [keywordPhrase, setKeywordPhrase] = useState("");
  const [keywordTaxonomyId, setKeywordTaxonomyId] = useState("");

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [acceptedCategories, setAcceptedCategories] = useState<Set<number>>(new Set());
  const [acceptedKeywords, setAcceptedKeywords] = useState<Set<number>>(new Set());

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/taxonomy/scan-suggestions");
      return res.json() as Promise<ScanResult>;
    },
    onSuccess: (data) => {
      setScanResult(data);
      setShowSuggestions(true);
      setAcceptedCategories(new Set());
      setAcceptedKeywords(new Set());
      toast({ title: `Scan complete`, description: `Scanned ${data.scannedReports} reports and ${data.scannedInteractions} interactions` });
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message || "Failed to scan for suggestions", variant: "destructive" });
    },
  });

  function handleAcceptCategory(suggestion: CategorySuggestion, index: number) {
    createTaxonomy.mutate(
      { name: suggestion.name, description: suggestion.description, color: suggestion.color || "purple" },
      {
        onSuccess: () => {
          toast({ title: `Category "${suggestion.name}" added` });
          setAcceptedCategories(prev => new Set(prev).add(index));
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  }

  function handleAcceptKeyword(suggestion: KeywordSuggestion, index: number) {
    const matchingCategory = taxonomyItems.find((t: any) =>
      t.name.toLowerCase() === suggestion.suggestedCategory.toLowerCase()
    );
    if (!matchingCategory) {
      toast({ title: "Category not found", description: `Create the "${suggestion.suggestedCategory}" category first, then accept this keyword.`, variant: "destructive" });
      return;
    }
    createKeyword.mutate(
      { phrase: suggestion.phrase, taxonomyId: matchingCategory.id },
      {
        onSuccess: () => {
          toast({ title: `Keyword "${suggestion.phrase}" added` });
          setAcceptedKeywords(prev => new Set(prev).add(index));
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  }

  function resetCategoryForm() {
    setCategoryName("");
    setCategoryDescription("");
    setCategoryColor("purple");
    setShowCategoryForm(false);
  }

  function resetKeywordForm() {
    setKeywordPhrase("");
    setKeywordTaxonomyId("");
    setShowKeywordForm(false);
  }

  function handleCreateCategory() {
    if (!categoryName.trim()) return;
    createTaxonomy.mutate(
      { name: categoryName.trim(), description: categoryDescription.trim() || null, color: categoryColor },
      {
        onSuccess: () => {
          toast({ title: "Category created" });
          resetCategoryForm();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  }

  function startEdit(item: any) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description || "");
    setEditColor(item.color || "purple");
  }

  function handleUpdateCategory() {
    if (!editingId || !editName.trim()) return;
    updateTaxonomy.mutate(
      { id: editingId, name: editName.trim(), description: editDescription.trim() || null, color: editColor },
      {
        onSuccess: () => {
          toast({ title: "Category updated" });
          setEditingId(null);
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  }

  function handleToggleActive(item: any) {
    updateTaxonomy.mutate(
      { id: item.id, active: !item.active },
      {
        onSuccess: () => {
          toast({ title: item.active ? "Category deactivated" : "Category activated" });
        },
      }
    );
  }

  function handleDeleteCategory(id: number) {
    deleteTaxonomy.mutate(id, {
      onSuccess: () => {
        toast({ title: "Category deleted" });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  }

  function handleCreateKeyword() {
    if (!keywordPhrase.trim() || !keywordTaxonomyId) return;
    createKeyword.mutate(
      { phrase: keywordPhrase.trim(), taxonomyId: parseInt(keywordTaxonomyId) },
      {
        onSuccess: () => {
          toast({ title: "Keyword added" });
          resetKeywordForm();
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  }

  function handleDeleteKeyword(id: number) {
    deleteKeyword.mutate(id, {
      onSuccess: () => {
        toast({ title: "Keyword deleted" });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  }

  function getCategoryName(taxonomyId: number) {
    const item = taxonomyItems.find((t: any) => t.id === taxonomyId);
    return item ? item.name : "Unknown";
  }

  function getCategoryColor(taxonomyId: number) {
    const item = taxonomyItems.find((t: any) => t.id === taxonomyId);
    return getColorClasses(item?.color);
  }

  return (
    <main className="flex-1 p-4 md:p-8 pb-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Taxonomy Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Customize impact categories and keyword mappings for AI extraction
          </p>
        </div>

        <div className="mb-6">
          <Card className="p-4 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Scan className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">AI-Powered Taxonomy Scanner</p>
                  <p className="text-xs text-muted-foreground">Scans legacy reports, interactions, and debriefs for new categories and keywords</p>
                </div>
              </div>
              <Button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
                data-testid="button-scan-taxonomy"
              >
                {scanMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Scan for Suggestions
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {scanResult && showSuggestions && (
          <div className="mb-6 space-y-4" data-testid="panel-scan-results">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">AI Suggestions</h2>
                <Badge variant="secondary" className="text-xs">
                  {scanResult.scannedReports} reports, {scanResult.scannedInteractions} interactions scanned
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSuggestions(false)}
                data-testid="button-collapse-suggestions"
              >
                <ChevronUp className="w-4 h-4 mr-1" />
                Collapse
              </Button>
            </div>

            {scanResult.categorySuggestions.length > 0 && (
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tags className="w-4 h-4 text-primary" />
                    Suggested Categories ({scanResult.categorySuggestions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {scanResult.categorySuggestions.map((s, i) => {
                    const accepted = acceptedCategories.has(i);
                    const colors = getColorClasses(s.color);
                    return (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${accepted ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-background"}`} data-testid={`suggestion-category-${i}`}>
                        <span className={`w-3 h-3 rounded-full shrink-0 mt-1 ${colors.bg}`} />
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{s.name}</span>
                            <Badge variant="secondary" className="text-[10px]">{s.confidence}% confidence</Badge>
                            {accepted && <Badge className="text-[10px] bg-green-600">Added</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                          {s.evidence && (
                            <p className="text-xs text-muted-foreground/70 italic">Evidence: {s.evidence}</p>
                          )}
                        </div>
                        {!accepted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcceptCategory(s, i)}
                            disabled={createTaxonomy.isPending}
                            className="shrink-0"
                            data-testid={`button-accept-category-${i}`}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {scanResult.keywordSuggestions.length > 0 && (
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Suggested Keywords ({scanResult.keywordSuggestions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {scanResult.keywordSuggestions.map((s, i) => {
                    const accepted = acceptedKeywords.has(i);
                    const matchingCategory = taxonomyItems.find((t: any) =>
                      t.name.toLowerCase() === s.suggestedCategory.toLowerCase()
                    );
                    return (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${accepted ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-background"}`} data-testid={`suggestion-keyword-${i}`}>
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">"{s.phrase}"</span>
                            <Badge variant="outline" className="text-[10px]">
                              {matchingCategory ? s.suggestedCategory : `${s.suggestedCategory} (new)`}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">{s.confidence}%</Badge>
                            {accepted && <Badge className="text-[10px] bg-green-600">Added</Badge>}
                          </div>
                          {s.evidence && (
                            <p className="text-xs text-muted-foreground/70 italic">Source: {s.evidence}</p>
                          )}
                        </div>
                        {!accepted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcceptKeyword(s, i)}
                            disabled={createKeyword.isPending || !matchingCategory}
                            className="shrink-0"
                            data-testid={`button-accept-keyword-${i}`}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {scanResult.categorySuggestions.length === 0 && scanResult.keywordSuggestions.length === 0 && (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">No new suggestions found. Your taxonomy looks comprehensive!</p>
              </Card>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setScanResult(null); setShowSuggestions(false); }}
                data-testid="button-dismiss-scan"
              >
                Dismiss All
              </Button>
            </div>
          </div>
        )}

        {scanResult && !showSuggestions && (
          <div className="mb-6">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSuggestions(true)}
              data-testid="button-expand-suggestions"
            >
              <ChevronDown className="w-4 h-4 mr-1" />
              Show AI Suggestions ({scanResult.categorySuggestions.length} categories, {scanResult.keywordSuggestions.length} keywords)
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Impact Categories */}
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="w-5 h-5 text-primary" />
                  Impact Categories
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Define categories for classifying impact data
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowCategoryForm(true)}
                data-testid="button-add-category"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Category
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {showCategoryForm && (
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30" data-testid="form-add-category">
                  <div className="space-y-1">
                    <Label htmlFor="cat-name">Name</Label>
                    <Input
                      id="cat-name"
                      placeholder="e.g. Financial Literacy"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      data-testid="input-category-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cat-desc">Description</Label>
                    <Input
                      id="cat-desc"
                      placeholder="Brief description..."
                      value={categoryDescription}
                      onChange={(e) => setCategoryDescription(e.target.value)}
                      data-testid="input-category-description"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Color</Label>
                    <Select value={categoryColor} onValueChange={setCategoryColor}>
                      <SelectTrigger data-testid="select-category-color">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            <span className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${c.bg}`} />
                              {c.value.charAt(0).toUpperCase() + c.value.slice(1)}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={createTaxonomy.isPending || !categoryName.trim()}
                      data-testid="button-save-category"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={resetCategoryForm}
                      data-testid="button-cancel-category"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {taxonomyLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading categories...</div>
              ) : taxonomyItems.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground" data-testid="text-no-categories">
                  No categories yet. Add one to get started.
                </div>
              ) : (
                taxonomyItems.map((item: any) => {
                  const colors = getColorClasses(item.color);
                  const isEditing = editingId === item.id;

                  if (isEditing) {
                    return (
                      <div
                        key={item.id}
                        className="border border-border rounded-lg p-4 space-y-3 bg-muted/30"
                        data-testid={`form-edit-category-${item.id}`}
                      >
                        <div className="space-y-1">
                          <Label>Name</Label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            data-testid={`input-edit-name-${item.id}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Description</Label>
                          <Input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            data-testid={`input-edit-description-${item.id}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Color</Label>
                          <Select value={editColor} onValueChange={setEditColor}>
                            <SelectTrigger data-testid={`select-edit-color-${item.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COLOR_OPTIONS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  <span className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${c.bg}`} />
                                    {c.value.charAt(0).toUpperCase() + c.value.slice(1)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={handleUpdateCategory}
                            disabled={updateTaxonomy.isPending || !editName.trim()}
                            data-testid={`button-save-edit-${item.id}`}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                            data-testid={`button-cancel-edit-${item.id}`}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border"
                      data-testid={`card-category-${item.id}`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${colors.bg}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground truncate" data-testid={`text-category-name-${item.id}`}>
                            {item.name}
                          </span>
                          <Badge
                            variant={item.active ? "default" : "secondary"}
                            className="text-xs"
                            data-testid={`badge-category-status-${item.id}`}
                          >
                            {item.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleToggleActive(item)}
                          data-testid={`button-toggle-active-${item.id}`}
                        >
                          {item.active ? (
                            <X className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Check className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(item)}
                          data-testid={`button-edit-category-${item.id}`}
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteCategory(item.id)}
                          data-testid={`button-delete-category-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Right: Keyword Dictionary */}
          <Card className="rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Keyword Dictionary
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Map phrases to impact categories for better AI classification
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowKeywordForm(true)}
                disabled={taxonomyItems.length === 0}
                data-testid="button-add-keyword"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Keyword
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {showKeywordForm && (
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30" data-testid="form-add-keyword">
                  <div className="space-y-1">
                    <Label htmlFor="kw-phrase">Phrase</Label>
                    <Input
                      id="kw-phrase"
                      placeholder="e.g. revenue growth"
                      value={keywordPhrase}
                      onChange={(e) => setKeywordPhrase(e.target.value)}
                      data-testid="input-keyword-phrase"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={keywordTaxonomyId} onValueChange={setKeywordTaxonomyId}>
                      <SelectTrigger data-testid="select-keyword-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {taxonomyItems
                          .filter((t: any) => t.active)
                          .map((t: any) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              <span className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${getColorClasses(t.color).bg}`} />
                                {t.name}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={handleCreateKeyword}
                      disabled={createKeyword.isPending || !keywordPhrase.trim() || !keywordTaxonomyId}
                      data-testid="button-save-keyword"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={resetKeywordForm}
                      data-testid="button-cancel-keyword"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {keywordsLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading keywords...</div>
              ) : keywords.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground" data-testid="text-no-keywords">
                  No keywords yet. Add phrases to improve AI classification.
                </div>
              ) : (
                keywords.map((kw: any) => {
                  const colors = getCategoryColor(kw.taxonomyId);
                  return (
                    <div
                      key={kw.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border"
                      data-testid={`card-keyword-${kw.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground" data-testid={`text-keyword-phrase-${kw.id}`}>
                          {kw.phrase}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`w-2 h-2 rounded-full ${colors.bg}`} />
                          <span className="text-sm text-muted-foreground" data-testid={`text-keyword-category-${kw.id}`}>
                            {getCategoryName(kw.taxonomyId)}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteKeyword(kw.id)}
                        data-testid={`button-delete-keyword-${kw.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </main>
  );
}
