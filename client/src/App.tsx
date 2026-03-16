import { Switch, Route, Redirect, useLocation } from "wouter";
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
import CohortAnalysisPage from "@/pages/cohort-analysis";
import CommunitySpend from "@/pages/community-spend";
import GmailImportPage from "@/pages/gmail-import";
import FundersPage from "@/pages/funders";
import MentoringPage from "@/pages/mentoring";
import SchedulingPage from "@/pages/scheduling";
import PublicBookingPage from "@/pages/public-booking";
import ProjectDetailPage from "@/pages/project-detail";
import ProjectsPage from "@/pages/projects";
import BookingDetailPage from "@/pages/booking-detail";
import PublicSurveyPage from "@/pages/public-survey";
import BookerPortalPage from "@/pages/booker-portal";
import CatchUpPage from "@/pages/catch-up";
import PublicRegistrationPage from "@/pages/public-registration";
import ResourceCalendarPage from "@/pages/resource-calendar";
import SpacesPage from "@/pages/spaces";
import GearPage from "@/pages/gear";
import AboutUsPage from "@/pages/about-us";

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

const PUBLIC_ROUTE_PREFIXES = ['/book/', '/register/', '/survey/', '/booker/'];

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();

  const isPublicRoute = PUBLIC_ROUTE_PREFIXES.some((prefix) => location.startsWith(prefix));

  if (!user || isPublicRoute) {
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

        <Route path="/community/people">
          <ProtectedRoute component={Contacts} />
        </Route>

        <Route path="/community/groups">
          <ProtectedRoute component={GroupsPage} />
        </Route>

        <Route path="/community/ecosystems">
          <ProtectedRoute component={EcosystemPage} />
        </Route>

        <Route path="/community">
          <Redirect to="/community/people" />
        </Route>

        <Route path="/contacts/:id">
          <ProtectedRoute component={ContactDetail} />
        </Route>

        <Route path="/contacts">
          <Redirect to="/community/people" />
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

        <Route path="/scheduling">
          <ProtectedRoute component={SchedulingPage} />
        </Route>

        <Route path="/mentoring">
          <ProtectedRoute component={MentoringPage} />
        </Route>

        <Route path="/programmes">
          <ProtectedRoute component={Programmes} />
        </Route>

        <Route path="/regular-bookers">
          <Redirect to="/spaces?tab=bookers" />
        </Route>

        <Route path="/spaces">
          <ProtectedRoute component={SpacesPage} />
        </Route>

        <Route path="/gear">
          <ProtectedRoute component={GearPage} />
        </Route>

        <Route path="/bookings/:id">
          <ProtectedRoute component={BookingDetailPage} />
        </Route>

        <Route path="/bookings">
          <Redirect to="/spaces?tab=venue-hire" />
        </Route>

        <Route path="/agreements">
          <ProtectedRoute component={Agreements} />
        </Route>

        <Route path="/groups">
          <Redirect to="/community/groups" />
        </Route>

        <Route path="/ecosystem">
          <Redirect to="/community/ecosystems" />
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

        <Route path="/cohort-analysis">
          <ProtectedRoute component={CohortAnalysisPage} />
        </Route>

        <Route path="/gmail-import">
          <ProtectedRoute component={GmailImportPage} />
        </Route>

        <Route path="/funders">
          <ProtectedRoute component={FundersPage} />
        </Route>

        <Route path="/projects/:id">
          <ProtectedRoute component={ProjectDetailPage} />
        </Route>

        <Route path="/projects">
          <ProtectedRoute component={ProjectsPage} />
        </Route>

        <Route path="/catch-up">
          <ProtectedRoute component={CatchUpPage} />
        </Route>

        <Route path="/settings/about-us">
          <ProtectedRoute component={AboutUsPage} />
        </Route>

        <Route path="/resource-calendar">
          <Redirect to="/spaces" />
        </Route>

        <Route path="/register/:slug">
          <PublicRegistrationPage />
        </Route>

        <Route path="/book/:userId">
          <PublicBookingPage />
        </Route>

        <Route path="/survey/:token">
          <PublicSurveyPage />
        </Route>

        <Route path="/booker/login">
          <BookerPortalPage />
        </Route>

        <Route path="/booker/portal/:token">
          <BookerPortalPage />
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
