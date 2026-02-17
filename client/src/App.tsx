import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

// Pages
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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      // No user, redirect to landing
      // Note: Landing is at /, but if we are at a deep route, we might want to redirect to / first
      // But actually, for this app structure:
      // / -> Landing (if not logged in) OR Dashboard (if logged in)
      // So ProtectedRoute logic is simpler: if no user, render null (and effect redirects or we show landing)
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
    // If not logged in, show Landing Page instead of redirecting loop
    return <LandingPage />;
  }

  return <Component />;
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
    <Switch>
      {/* 
        Root path "/" behaves differently based on auth:
        - Logged in -> Dashboard
        - Logged out -> Landing Page
      */}
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

      <Route path="/programmes">
        <ProtectedRoute component={Programmes} />
      </Route>

      <Route path="/bookings">
        <ProtectedRoute component={Bookings} />
      </Route>

      <Route path="/agreements">
        <ProtectedRoute component={Agreements} />
      </Route>

      <Route component={NotFound} />
    </Switch>
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
