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
  DollarSign,
  CalendarDays,
  Activity,
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
  { name: "Calendar", href: "/calendar", icon: CalendarCheck },
  {
    name: "Community", href: "/contacts", icon: Users,
    children: [
      { name: "People", href: "/contacts", icon: Users },
      { name: "Groups", href: "/groups", icon: Network },
      { name: "Ecosystem", href: "/ecosystem", icon: Handshake },
    ],
  },
  {
    name: "Delivery", href: "/programmes", icon: Layers,
    children: [
      { name: "Programmes", href: "/programmes", icon: Layers },
      { name: "Bookings", href: "/bookings", icon: Building2 },
      { name: "Agreements", href: "/agreements", icon: Handshake },
    ],
  },
  {
    name: "Tracking", href: "/debriefs", icon: Activity,
    children: [
      { name: "Interactions", href: "/debriefs", icon: Mic },
      { name: "Impact Logs", href: "/debrief-queue", icon: ClipboardList },
      { name: "Debriefs", href: "/weekly-debriefs", icon: CalendarDays },
      { name: "Community Spend", href: "/community-spend", icon: DollarSign },
    ],
  },
  {
    name: "Reporting", href: "/reports", icon: FileText,
    children: [
      { name: "Reports", href: "/reports", icon: FileText },
      { name: "Legacy Reports", href: "/legacy-reports", icon: BookOpen },
      { name: "Taxonomy", href: "/taxonomy", icon: Tags },
    ],
  },
];

const bottomNavItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Calendar", href: "/calendar", icon: CalendarCheck },
  { name: "Community", href: "/contacts", icon: Users },
  { name: "Tracking", href: "/debriefs", icon: Activity },
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
    <div className="sidebar-dark flex flex-col h-full bg-[hsl(var(--sidebar-bg))]">
      <div className="px-5 py-5 border-b border-[hsl(var(--sidebar-border))]">
        <Link href="/" className="flex items-center gap-3 group" onClick={onNavigate}>
          <div className="bg-[hsl(var(--sidebar-accent))] p-1.5 rounded-lg">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-white">
            ReserveTMK
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          if (item.children) {
            const isChildActive = item.children.some(c => location === c.href);
            const isExpanded = expandedGroups[item.name] ?? isChildActive;

            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleGroup(item.name)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-150 w-full text-left text-[13px] font-medium",
                    isChildActive
                      ? "bg-[hsl(var(--sidebar-active))] text-white"
                      : "text-[hsl(var(--sidebar-text))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-white",
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200 opacity-60", isExpanded ? "rotate-180" : "")} />
                </button>
                <div className={cn(
                  "overflow-hidden transition-all duration-200 ease-in-out",
                  isExpanded ? "max-h-60 opacity-100 mt-0.5" : "max-h-0 opacity-0"
                )}>
                  {item.children.map((child) => {
                    const isSubActive = location === child.href;
                    return (
                      <Link
                        key={child.name}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-3 pl-9 pr-3 py-2 rounded-md transition-colors duration-150 text-[13px]",
                          isSubActive
                            ? "text-white bg-[hsl(var(--sidebar-active))] font-medium"
                            : "text-[hsl(var(--sidebar-text))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-white",
                        )}
                        onClick={onNavigate}
                        data-testid={`nav-${child.name.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <child.icon className="w-4 h-4 flex-shrink-0" />
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
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-150 text-[13px] font-medium",
                isActive
                  ? "bg-[hsl(var(--sidebar-active))] text-white"
                  : "text-[hsl(var(--sidebar-text))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-white",
              )}
              onClick={onNavigate}
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[hsl(var(--sidebar-border))] mt-auto">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--sidebar-accent))] flex items-center justify-center text-white text-sm font-semibold">
            {user?.firstName?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] truncate text-[hsl(var(--sidebar-text))]">
              {user?.email}
            </p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-[13px] text-[hsl(var(--sidebar-text))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-white transition-colors duration-150"
          onClick={() => logout()}
          data-testid="button-sign-out"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
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
          <SheetContent side="left" className="p-0 w-64 border-0">
            <NavContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Mobile bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[hsl(220,26%,14%)] border-t border-[hsl(220,20%,22%)] safe-area-bottom" data-testid="nav-bottom-bar">
        <div className="flex items-stretch justify-around">
          {bottomNavItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-3 flex-1 min-w-0 transition-colors",
                  isActive ? "text-white" : "text-[hsl(210,20%,55%)]",
                )}
                data-testid={`bottom-nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon className={cn("w-5 h-5 mb-0.5", isActive && "text-white")} />
                <span className={cn("text-[10px] font-medium truncate", isActive && "text-white")}>
                  {item.name}
                </span>
              </Link>
            );
          })}
          <Link
            href="#"
            onClick={(e) => { e.preventDefault(); setOpen(true); }}
            className="flex flex-col items-center justify-center py-2 px-3 flex-1 min-w-0 transition-colors text-[hsl(210,20%,55%)]"
            data-testid="bottom-nav-more"
          >
            <MoreHorizontal className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-medium">More</span>
          </Link>
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50">
        <NavContent />
      </aside>
    </>
  );
}
