import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  LogOut,
  BrainCircuit,
  Tags,
  Menu,
  FileText,
  Mic,
  CheckSquare,
  CalendarCheck,
  MoreHorizontal,
  Layers,
  Building2,
  Handshake,
  Network,
  ChevronDown,
  ClipboardList,
  BookOpen,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "../ui/beautiful-button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
};

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  {
    name: "Community", href: "/contacts", icon: Users,
    children: [
      { name: "People", href: "/contacts", icon: Users },
      { name: "Groups", href: "/groups", icon: Network },
    ],
  },
  {
    name: "Hub Ops", href: "/calendar", icon: Settings,
    children: [
      { name: "Calendar", href: "/calendar", icon: CalendarCheck },
      { name: "Programmes", href: "/programmes", icon: Layers },
      { name: "Bookings", href: "/bookings", icon: Building2 },
      { name: "Agreements", href: "/agreements", icon: Handshake },
    ],
  },
  {
    name: "Debriefs", href: "/debriefs", icon: Mic,
    children: [
      { name: "Log Debrief", href: "/debriefs", icon: Mic },
      { name: "Debrief Queue", href: "/debrief-queue", icon: ClipboardList },
    ],
  },
  {
    name: "Reporting", href: "/reports", icon: FileText,
    children: [
      { name: "Reports", href: "/reports", icon: FileText },
      { name: "Legacy Reports", href: "/legacy-reports", icon: BookOpen },
    ],
  },
  { name: "Actions", href: "/actions", icon: CheckSquare },
  { name: "Taxonomy", href: "/taxonomy", icon: Tags },
];

const bottomNavItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Community", href: "/contacts", icon: Users },
  { name: "Calendar", href: "/calendar", icon: CalendarCheck },
  { name: "Reports", href: "/reports", icon: FileText },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [open, setOpen] = useState(false);

  const getInitialExpanded = () => {
    const expanded: Record<string, boolean> = {};
    navigation.forEach((item) => {
      if (item.children) {
        const isChildActive = item.children.some(c => location === c.href);
        expanded[item.name] = isChildActive;
      }
    });
    return expanded;
  };

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(getInitialExpanded);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const NavContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-8">
        <Link href="/" className="flex items-center gap-2 group" onClick={onNavigate}>
          <div className="bg-primary p-2 rounded-xl group-hover:bg-primary/90 transition-colors">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">
            ReserveTMK
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          if (item.children) {
            const isChildActive = item.children.some(c => location === c.href);
            const isExpanded = expandedGroups[item.name] ?? isChildActive;

            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleGroup(item.name)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium w-full text-left",
                    isChildActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover-elevate",
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className={cn("w-5 h-5", isChildActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className="flex-1">{item.name}</span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded ? "rotate-180" : "")} />
                </button>
                <div className={cn(
                  "ml-4 mt-1 space-y-0.5 overflow-hidden transition-all duration-300 ease-in-out",
                  isExpanded ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                )}>
                  {item.children.map((child) => {
                    const isSubActive = location === child.href;
                    return (
                      <Link
                        key={child.name}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 group font-medium text-sm",
                          isSubActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover-elevate",
                        )}
                        onClick={onNavigate}
                        data-testid={`nav-${child.name.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <child.icon className={cn("w-4 h-4", isSubActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover-elevate",
              )}
              onClick={onNavigate}
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
            {user?.firstName?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={() => logout()}
          data-testid="button-sign-out"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger trigger - top left */}
      <div className="md:hidden fixed top-3 left-3 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shadow-md bg-background" data-testid="button-mobile-menu">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <NavContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Mobile bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 shadow-lg shadow-black/10 safe-area-bottom" data-testid="nav-bottom-bar">
        <div className="flex items-stretch justify-around gap-1">
          {bottomNavItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-3 flex-1 min-w-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
                data-testid={`bottom-nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon className={cn("w-5 h-5 mb-0.5", isActive && "text-primary")} />
                <span className={cn("text-[10px] font-medium truncate", isActive && "text-primary")}>
                  {item.name}
                </span>
              </Link>
            );
          })}
          <Link
            href="#"
            onClick={(e) => { e.preventDefault(); setOpen(true); }}
            className="flex flex-col items-center justify-center py-2 px-3 flex-1 min-w-0 transition-colors text-muted-foreground"
            data-testid="bottom-nav-more"
          >
            <MoreHorizontal className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">More</span>
          </Link>
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-col fixed inset-y-0 z-50 bg-card border-r border-border/50 shadow-xl shadow-black/5">
        <NavContent />
      </aside>
    </>
  );
}
