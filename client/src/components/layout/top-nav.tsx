import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Menu,
  FileText,
  Mic,
  CheckSquare,
  CalendarCheck,
  Layers,
  Building2,
  Handshake,
  Network,
  ChevronDown,
  ClipboardList,
  BookOpen,
  Tags,
  Settings,
  BarChart3,
  X,
  Shield,
  Calendar,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useRef, useEffect } from "react";

type NavChild = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
};

type NavGroup = {
  name: string;
  href: string;
  children: NavChild[];
};

const navGroups: NavGroup[] = [
  {
    name: "Dashboard",
    href: "/",
    children: [],
  },
  {
    name: "Community",
    href: "/contacts",
    children: [
      { name: "People", href: "/contacts", icon: Users, description: "Manage contacts & mentees" },
      { name: "Groups", href: "/groups", icon: Network, description: "Organisations & collectives" },
    ],
  },
  {
    name: "Delivery",
    href: "/calendar",
    children: [
      { name: "Calendar", href: "/calendar", icon: CalendarCheck, description: "Events & scheduling" },
      { name: "Programmes", href: "/programmes", icon: Layers, description: "Workshops & activations" },
      { name: "Debriefs", href: "/debriefs", icon: Mic, description: "Log impact debriefs" },
      { name: "Debrief Queue", href: "/debrief-queue", icon: ClipboardList, description: "Reconcile pending debriefs" },
      { name: "Action Items", href: "/actions", icon: CheckSquare, description: "Track follow-ups" },
      { name: "Milestones", href: "/milestones", icon: Trophy, description: "Achievements & outcomes" },
      { name: "Programme Effectiveness", href: "/programme-effectiveness", icon: BarChart3, description: "Programme quality metrics" },
    ],
  },
  {
    name: "Space",
    href: "/bookings",
    children: [
      { name: "Bookings", href: "/bookings", icon: Building2, description: "Venue hire & spaces" },
      { name: "Agreements", href: "/agreements", icon: Handshake, description: "Memberships & MOUs" },
    ],
  },
  {
    name: "Reporting",
    href: "/reports",
    children: [
      { name: "Reports", href: "/reports", icon: FileText, description: "Monthly & quarterly reports" },
      { name: "Legacy Reports", href: "/legacy-reports", icon: BookOpen, description: "Historical PDF uploads" },
    ],
  },
  {
    name: "Settings",
    href: "/taxonomy",
    children: [
      { name: "Taxonomy", href: "/taxonomy", icon: Tags, description: "Impact categories & tags" },
    ],
  },
];

function DropdownMenu({ group, isOpen, onToggle, onClose, onNavigate }: {
  group: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  const isGroupActive = group.children.length === 0
    ? location === group.href
    : group.children.some(c => location === c.href);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (group.children.length === 0) {
    return (
      <Link
        href={group.href}
        className={cn(
          "px-3 py-2 text-[13px] font-medium rounded-md transition-colors",
          isGroupActive
            ? "text-white bg-[hsl(var(--nav-active))]"
            : "text-[hsl(var(--nav-text))] hover:text-white hover:bg-[hsl(var(--nav-hover))]",
        )}
        onClick={onNavigate}
        data-testid={`nav-${group.name.toLowerCase()}`}
      >
        {group.name}
      </Link>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-1 px-3 py-2 text-[13px] font-medium rounded-md transition-colors",
          isGroupActive || isOpen
            ? "text-white bg-[hsl(var(--nav-active))]"
            : "text-[hsl(var(--nav-text))] hover:text-white hover:bg-[hsl(var(--nav-hover))]",
        )}
        data-testid={`nav-${group.name.toLowerCase()}`}
      >
        {group.name}
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-xl z-[60] py-1 animate-in fade-in-0 zoom-in-95 duration-150"
          data-testid={`dropdown-${group.name.toLowerCase()}`}
        >
          {group.children.map((child) => {
            const isActive = location === child.href;
            return (
              <Link
                key={child.name}
                href={child.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                )}
                onClick={() => { onClose(); onNavigate?.(); }}
                data-testid={`nav-${child.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <child.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-medium", isActive && "text-primary")}>{child.name}</div>
                  {child.description && (
                    <div className="text-[11px] text-muted-foreground truncate">{child.description}</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TopNav() {
  const { logout, user } = useAuth();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [location]);

  return (
    <>
      <header className="topnav fixed top-0 left-0 right-0 z-50 bg-[hsl(var(--nav-bg))] border-b border-[hsl(var(--nav-border))]" data-testid="top-nav">
        <div className="flex items-center h-14 px-4 max-w-full">
          <Link href="/" className="flex items-center gap-2 mr-6 flex-shrink-0" data-testid="nav-logo">
            <div className="bg-[hsl(var(--brand-coral))] w-8 h-8 rounded-lg flex items-center justify-center">
              <span className="text-white font-display font-bold text-sm">R</span>
            </div>
            <span className="font-display font-bold text-base text-white hidden sm:block">
              ReserveTMK
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navGroups.map((group) => (
              <DropdownMenu
                key={group.name}
                group={group}
                isOpen={openMenu === group.name}
                onToggle={() => setOpenMenu(openMenu === group.name ? null : group.name)}
                onClose={() => setOpenMenu(null)}
              />
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[hsl(var(--brand-coral))] flex items-center justify-center text-white text-xs font-semibold">
                  {user?.firstName?.[0] || "U"}
                </div>
                <span className="text-[13px] text-[hsl(var(--nav-text))] hidden lg:block">
                  {user?.firstName}
                </span>
              </div>
              <button
                onClick={() => logout()}
                className="text-[hsl(var(--nav-text))] hover:text-white transition-colors p-1.5 rounded-md hover:bg-[hsl(var(--nav-hover))]"
                data-testid="button-sign-out"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <button
              className="md:hidden text-white p-1.5"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-14 left-0 right-0 bg-card border-b border-border shadow-xl max-h-[calc(100vh-3.5rem)] overflow-y-auto animate-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
            data-testid="mobile-nav-panel"
          >
            <div className="p-2">
              {navGroups.map((group) => (
                <MobileNavGroup key={group.name} group={group} onNavigate={() => setMobileOpen(false)} />
              ))}

              <div className="border-t border-border mt-2 pt-2">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-[hsl(var(--brand-coral))] flex items-center justify-center text-white text-sm font-semibold">
                    {user?.firstName?.[0] || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted rounded-md transition-colors"
                  data-testid="mobile-sign-out"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileNavGroup({ group, onNavigate }: { group: NavGroup; onNavigate: () => void }) {
  const [location] = useLocation();
  const [expanded, setExpanded] = useState(false);

  if (group.children.length === 0) {
    const isActive = location === group.href;
    return (
      <Link
        href={group.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
          isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
        )}
        onClick={onNavigate}
        data-testid={`mobile-nav-${group.name.toLowerCase()}`}
      >
        {group.name}
      </Link>
    );
  }

  const isGroupActive = group.children.some(c => location === c.href);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
          isGroupActive ? "text-primary" : "text-foreground hover:bg-muted",
        )}
        data-testid={`mobile-nav-${group.name.toLowerCase()}`}
      >
        <span className="flex-1 text-left">{group.name}</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="ml-3 border-l border-border pl-3 space-y-0.5 mb-1">
          {group.children.map((child) => {
            const isActive = location === child.href;
            return (
              <Link
                key={child.name}
                href={child.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={onNavigate}
                data-testid={`mobile-nav-${child.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <child.icon className="w-4 h-4 flex-shrink-0" />
                {child.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
