import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Loader2, Save, X, Plus, Building2 } from "lucide-react";
import type { OrganisationProfile } from "@shared/schema";

export default function AboutUsPage() {
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery<OrganisationProfile | null>({
    queryKey: ["/api/organisation-profile"],
  });

  const [form, setForm] = useState({
    mission: "",
    description: "",
    focusAreas: [] as string[],
    values: "",
    location: "",
    targetCommunity: "",
  });

  const [focusInput, setFocusInput] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        mission: profile.mission || "",
        description: profile.description || "",
        focusAreas: profile.focusAreas || [],
        values: profile.values || "",
        location: profile.location || "",
        targetCommunity: profile.targetCommunity || "",
      });
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/organisation-profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organisation-profile"] });
      toast({ title: "Profile saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      mission: form.mission.trim() || null,
      description: form.description.trim() || null,
      focusAreas: form.focusAreas.length > 0 ? form.focusAreas : null,
      values: form.values.trim() || null,
      location: form.location.trim() || null,
      targetCommunity: form.targetCommunity.trim() || null,
    });
  };

  const addFocusArea = () => {
    const trimmed = focusInput.trim();
    if (trimmed && !form.focusAreas.includes(trimmed)) {
      setForm(prev => ({ ...prev, focusAreas: [...prev.focusAreas, trimmed] }));
      setFocusInput("");
    }
  };

  const removeFocusArea = (area: string) => {
    setForm(prev => ({ ...prev, focusAreas: prev.focusAreas.filter(a => a !== area) }));
  };

  const handleFocusKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFocusArea();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6" data-testid="about-us-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">About Us</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe your organisation's mission, identity, and focus. This information helps the AI generate more relevant reports.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="bg-primary/10 p-2.5 rounded-lg">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Organisation Profile</h2>
              <p className="text-xs text-muted-foreground">This is used as context for AI-generated reports</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mission Statement</Label>
            <Textarea
              value={form.mission}
              onChange={(e) => setForm(p => ({ ...p, mission: e.target.value }))}
              placeholder="e.g. To build access, confidence, belonging and purpose for urban Māori & Pasifika communities in Tāmaki through creative careers, micro business, and community initiatives."
              rows={3}
              data-testid="input-mission"
            />
          </div>

          <div className="space-y-2">
            <Label>What We Do</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="e.g. We support hyper-local entrepreneurs, small business owners, community leaders and innovators through mentoring, creative workshops, spaces, and community programmes."
              rows={4}
              data-testid="input-description"
            />
          </div>

          <div className="space-y-2">
            <Label>Focus Areas</Label>
            <div className="flex gap-2">
              <Input
                value={focusInput}
                onChange={(e) => setFocusInput(e.target.value)}
                onKeyDown={handleFocusKeyDown}
                placeholder="e.g. creative careers, micro business..."
                data-testid="input-focus-area"
              />
              <Button type="button" variant="outline" onClick={addFocusArea} data-testid="button-add-focus">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {form.focusAreas.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {form.focusAreas.map((area) => (
                  <Badge key={area} variant="secondary" className="gap-1 pr-1">
                    {area}
                    <button
                      type="button"
                      onClick={() => removeFocusArea(area)}
                      className="ml-1 hover:text-destructive"
                      data-testid={`button-remove-focus-${area.replace(/\s+/g, "-")}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Values & Principles</Label>
            <Textarea
              value={form.values}
              onChange={(e) => setForm(p => ({ ...p, values: e.target.value }))}
              placeholder="e.g. Whānau-centred, strengths-based, culturally grounded, community-led..."
              rows={3}
              data-testid="input-values"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="e.g. Tāmaki, Auckland"
                data-testid="input-location"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Community</Label>
              <Input
                value={form.targetCommunity}
                onChange={(e) => setForm(p => ({ ...p, targetCommunity: e.target.value }))}
                placeholder="e.g. urban Māori & Pasifika"
                data-testid="input-target-community"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-profile">
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Profile
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
