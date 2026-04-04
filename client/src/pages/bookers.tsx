import { useState, useCallback } from "react";
import { useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, Settings } from "lucide-react";
import RegularBookersPage from "./regular-bookers";
import Agreements from "./agreements";
import { BookerSettings } from "@/components/bookers/booker-settings";

function getTabFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || "bookers";
}

export default function BookersPage() {
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState(getTabFromUrl);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    const url = tab === "bookers" ? "/bookers" : `/bookers?tab=${tab}`;
    window.history.replaceState(null, "", url);
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Bookers</h1>
        <p className="text-sm text-muted-foreground">Agreements, portal access, and casual hire settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="bookers" data-testid="tab-bookers">
            <Users className="w-4 h-4 mr-2" />
            Bookers
          </TabsTrigger>
          <TabsTrigger value="agreements" data-testid="tab-agreements">
            <FileText className="w-4 h-4 mr-2" />
            Agreements
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookers" className="mt-4">
          <RegularBookersPage embedded />
        </TabsContent>

        <TabsContent value="agreements" className="mt-4">
          <Agreements embedded />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <BookerSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
