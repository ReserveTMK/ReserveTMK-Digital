import { Sidebar } from "@/components/layout/sidebar";
import { MetricCard } from "@/components/ui/metric-card";
import { useContacts } from "@/hooks/use-contacts";
import { useInteractions } from "@/hooks/use-interactions";
import { useAuth } from "@/hooks/use-auth";
import { Users, Activity, TrendingUp, Calendar, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: contacts, isLoading: loadingContacts } = useContacts();
  const { data: interactions, isLoading: loadingInteractions } = useInteractions();

  // Simple stats calculation
  const totalContacts = contacts?.length || 0;
  const totalInteractions = interactions?.length || 0;
  const recentInteractions = interactions?.slice(0, 5) || [];
  
  // Calculate average confidence from last 10 interactions for a "pulse"
  const recentConfidence = interactions
    ?.slice(0, 10)
    .reduce((acc, curr) => acc + (curr.analysis?.confidenceScore || 0), 0);
  const avgConfidence = recentConfidence && interactions?.length 
    ? (recentConfidence / Math.min(interactions.length, 10)).toFixed(1) 
    : "N/A";

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
              Welcome back, {user.firstName}!
            </h1>
            <p className="text-muted-foreground text-lg">
              Here's what's happening with your mentorship program.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <MetricCard
              title="Active Mentees"
              value={loadingContacts ? "..." : totalContacts}
              icon={<Users className="w-5 h-5" />}
              color="primary"
            />
            <MetricCard
              title="Total Interactions"
              value={loadingInteractions ? "..." : totalInteractions}
              icon={<Activity className="w-5 h-5" />}
              color="secondary"
            />
            <MetricCard
              title="Avg Confidence"
              value={avgConfidence}
              icon={<TrendingUp className="w-5 h-5" />}
              color="green"
              trend={avgConfidence !== "N/A" && Number(avgConfidence) > 7 ? "up" : "neutral"}
              trendValue="Good"
            />
            <MetricCard
              title="Next Session"
              value="Tomorrow"
              icon={<Calendar className="w-5 h-5" />}
              color="blue"
            />
          </div>

          {/* Recent Activity Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-display">Recent Interactions</h2>
              <Link href="/contacts" className="text-primary hover:underline text-sm font-medium flex items-center">
                View all contacts <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              {loadingInteractions ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentInteractions.length > 0 ? (
                <div className="divide-y divide-border">
                  {recentInteractions.map((interaction) => {
                    const contact = contacts?.find(c => c.id === interaction.contactId);
                    return (
                      <div key={interaction.id} className="p-6 hover:bg-muted/30 transition-colors flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                          {contact?.name?.[0] || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-foreground truncate">
                              {contact?.name || "Unknown Contact"}
                            </h3>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(interaction.date), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {interaction.summary || interaction.transcript || "No summary available."}
                          </p>
                          {interaction.analysis?.keyInsights && interaction.analysis.keyInsights.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {interaction.analysis.keyInsights.slice(0, 2).map((insight, idx) => (
                                <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                                  {insight}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  <p>No interactions logged yet. Start by adding a contact!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
