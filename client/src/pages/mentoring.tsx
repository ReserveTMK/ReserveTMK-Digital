import { Button } from "@/components/ui/beautiful-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Settings } from "lucide-react";
import { MeetingTypesSection } from "@/components/meeting-types-section";
import { SessionsTab } from "@/components/mentoring/sessions-tab";
import { MenteesTab } from "@/components/mentoring/mentees-tab";
import { MentorsTab } from "@/components/mentoring/mentors-tab";
import { GrowthSurveysTab } from "@/components/mentoring/growth-surveys-tab";
import { useMentoringApplications } from "@/components/mentoring/mentoring-hooks";

export default function MentoringPage() {
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("sessions");
  const { data: applications } = useMentoringApplications();
  const pendingCount = applications?.filter(a => a.status === "pending").length || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-mentoring">Mentoring</h1>
          <p className="text-muted-foreground text-sm">Manage mentoring relationships, sessions, and mentee journeys</p>
        </div>
        {activeTab === "sessions" && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowSettings(true)}
            data-testid="button-mentoring-settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        )}
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Settings</DialogTitle>
            <DialogDescription>Configure session types for mentoring</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <MeetingTypesSection category="mentoring" />
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="mentoring-tabs">
          <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
          <TabsTrigger value="mentees" data-testid="tab-mentees" className="relative">
            Mentees
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-bold text-white bg-blue-600 rounded-full" data-testid="badge-pending-apps">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="mentors" data-testid="tab-mentors">Mentors</TabsTrigger>
          <TabsTrigger value="growth-surveys" data-testid="tab-growth-surveys">Growth Surveys</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="mentees" className="mt-4">
          <MenteesTab />
        </TabsContent>
        <TabsContent value="mentors" className="mt-4">
          <MentorsTab />
        </TabsContent>
        <TabsContent value="growth-surveys" className="mt-4">
          <GrowthSurveysTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
