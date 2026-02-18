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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "../ui/beautiful-button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Community", href: "/contacts", icon: Users },
  { name: "Groups", href: "/groups", icon: Network },
  { name: "Calendar", href: "/calendar", icon: CalendarCheck },
  { name: "Programmes", href: "/programmes", icon: Layers },
  { name: "Bookings", href: "/bookings", icon: Building2 },
  { name: "Agreements", href: "/agreements", icon: Handshake },
  { name: "Debriefs", href: "/debriefs", icon: Mic },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Actions", href: "/actions", icon: CheckSquare },
  { name: "Taxonomy", href: "/taxonomy", icon: Tags },
];

const bottomNavItems = navigation.slice(0, 4);

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [open, setOpen] = useState(false);

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

      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
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
              data-testid={`nav-${item.name.toLowerCase()}`}
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
                data-testid={`bottom-nav-${item.name.toLowerCase()}`}
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
