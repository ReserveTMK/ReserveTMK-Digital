import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export interface MentoringTabProps {
  mentoringRelationships: any[];
  mentorProfiles: any[] | undefined;
  contactMetrics: Record<string, number> | undefined;
}

export function MentoringTab({ mentoringRelationships, mentorProfiles, contactMetrics }: MentoringTabProps) {
  return (
    <>
      {mentoringRelationships.map((rel: any) => {
        const mentor = mentorProfiles?.find((p: any) => p.id === rel.mentorId || `mentor-${p.id}` === rel.mentorId);
        const statusColors: Record<string, string> = {
          active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
          on_hold: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
          graduated: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
          ended: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
          application: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
        };
        return (
          <div key={rel.id} className="bg-card rounded-2xl p-6 border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Mentoring Relationship
              </h3>
              <Badge className={cn("text-xs", statusColors[rel.status] || "bg-gray-100")}>
                {rel.status === "on_hold" ? "On Hold" : rel.status?.charAt(0).toUpperCase() + rel.status?.slice(1)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {mentor && (
                <div>
                  <p className="text-xs text-muted-foreground">Mentor</p>
                  <p className="font-medium">{mentor.name}</p>
                </div>
              )}
              {rel.startDate && (
                <div>
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="font-medium">{format(new Date(rel.startDate), "d MMM yyyy")}</p>
                </div>
              )}
              {rel.frequency && (
                <div>
                  <p className="text-xs text-muted-foreground">Frequency</p>
                  <p className="font-medium capitalize">{rel.frequency}</p>
                </div>
              )}
              {rel.focusAreas && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Focus Areas</p>
                  <p className="font-medium">{rel.focusAreas}</p>
                </div>
              )}
            </div>

            {/* Growth scores from contact metrics */}
            {contactMetrics && Object.keys(contactMetrics).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Current Growth Scores</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(contactMetrics).filter(([, v]) => typeof v === "number" && v > 0).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5">
                      <span className="text-[10px] text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className="text-xs font-bold">{value}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rel.mentorNotes && (
              <div>
                <p className="text-xs text-muted-foreground">Mentor Notes</p>
                <p className="text-sm mt-1">{rel.mentorNotes}</p>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-center">
        <Link href="/mentoring">
          <Button variant="outline" size="sm">
            <Users className="w-4 h-4 mr-2" />
            View in Mentoring
          </Button>
        </Link>
      </div>
    </>
  );
}
