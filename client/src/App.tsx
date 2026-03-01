import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { TopNav } from "@/components/layout/top-nav";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import ContactDetail from "@/pages/contact-detail";
import Reports from "@/pages/reports";
import Debriefs from "@/pages/debriefs";
import Actions from "@/pages/actions";
import Taxonomy from "@/pages/taxonomy";
import CalendarPage from "@/pages/calendar";
import Programmes from "@/pages/programmes";
import Bookings from "@/pages/bookings";
import Agreements from "@/pages/agreements";
import GroupsPage from "@/pages/groups";
import EcosystemPage from "@/pages/ecosystem";
import LegacyReportsPage from "@/pages/legacy-reports";
import MilestonesPage from "@/pages/milestones";
import ProgrammeEffectivenessPage from "@/pages/programme-effectiveness";
import CommunitySpend from "@/pages/community-spend";
import GmailImportPage from "@/pages/gmail-import";
import FundersPage from "@/pages/funders";
import MentoringPage from "@/pages/mentoring";
import PublicBookingPage from "@/pages/public-booking";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return <Component />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="pt-14">
        {children}
      </main>
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
     return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/">
          {user ? <Dashboard /> : <LandingPage />}
        </Route>

        <Route path="/contacts">
          <ProtectedRoute component={Contacts} />
        </Route>
        
        <Route path="/contacts/:id">
          <ProtectedRoute component={ContactDetail} />
        </Route>

        <Route path="/debriefs">
          <ProtectedRoute component={Debriefs} />
        </Route>
        <Route path="/debriefs/:id">
          <ProtectedRoute component={Debriefs} />
        </Route>
        <Route path="/actions">
          <ProtectedRoute component={Actions} />
        </Route>

        <Route path="/reports">
          <ProtectedRoute component={Reports} />
        </Route>

        <Route path="/taxonomy">
          <ProtectedRoute component={Taxonomy} />
        </Route>

        <Route path="/calendar">
          <ProtectedRoute component={CalendarPage} />
        </Route>

        <Route path="/mentoring">
          <ProtectedRoute component={MentoringPage} />
        </Route>

        <Route path="/programmes">
          <ProtectedRoute component={Programmes} />
        </Route>

        <Route path="/bookings">
          <ProtectedRoute component={Bookings} />
        </Route>

        <Route path="/agreements">
          <ProtectedRoute component={Agreements} />
        </Route>

        <Route path="/groups">
          <ProtectedRoute component={GroupsPage} />
        </Route>

        <Route path="/ecosystem">
          <ProtectedRoute component={EcosystemPage} />
        </Route>

        <Route path="/community-spend">
          <ProtectedRoute component={CommunitySpend} />
        </Route>

        <Route path="/legacy-reports">
          <ProtectedRoute component={LegacyReportsPage} />
        </Route>

        <Route path="/milestones">
          <ProtectedRoute component={MilestonesPage} />
        </Route>

        <Route path="/programme-effectiveness">
          <ProtectedRoute component={ProgrammeEffectivenessPage} />
        </Route>

        <Route path="/gmail-import">
          <ProtectedRoute component={GmailImportPage} />
        </Route>

        <Route path="/funders">
          <ProtectedRoute component={FundersPage} />
        </Route>

        <Route path="/book/:userId">
          <PublicBookingPage />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
