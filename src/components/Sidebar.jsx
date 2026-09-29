import { 
  Settings, 
  HelpCircle,
  AlertTriangle,
  CreditCard,
  BarChart3,
  LayoutDashboard,
  ClipboardCheck,
  ShieldCheck,
  MonitorCheck,
  Clock3,
  PanelLeftClose,
  PanelLeftOpen,
  UsersRound,
  X
} from "lucide-react";

import { cn } from "../lib/utils";
import { toast } from "sonner";
import NZBritanniaLogo from "../assets/nz-britannia-logo.png";
import NZBritanniaLogoWhite from "../assets/nz-britannia-logo-white.png";
import NZBritanniaMark from "../assets/nz-britannia-mark.png";
import NZBritanniaMarkWhite from "../assets/nz-britannia-mark-white.png";
import { BrandRail } from "./BrandRail";

const NavItem = ({ icon: Icon, label, active = false, onClick, isOpen = true }) => (
  <button 
    onClick={onClick}
    className={cn(
      "sidebar-nav-item flex items-center w-full py-3 text-sm font-medium transition-all duration-300 rounded-lg group relative overflow-hidden",
      isOpen ? "px-4 gap-3" : "justify-center px-0",
      active 
        ? "sidebar-nav-item-active bg-white text-[var(--ct-green-950)] shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
        : "text-white/62 hover:bg-white/[0.08] hover:text-white"
    )}
    title={!isOpen ? label : undefined}
  >
    <div className={cn(
      "transition-transform duration-300 group-hover:scale-110",
      active ? "text-[var(--ct-green-800)]" : "text-white/42 group-hover:text-white"
    )}>
      <Icon size={20} />
    </div>
    {isOpen && <span className="truncate font-bold tracking-tight">{label}</span>}
    {active && isOpen && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-[var(--ct-gold)] rounded-r-full shadow-[0_0_8px_rgba(29,123,190,0.48)]" />
    )}
  </button>
);

const navItems = [
  {
    icon: ShieldCheck,
    label: "Super Admin",
    view: "super-admin",
    activeViews: ["super-admin"],
    roles: ["super_admin"],
  },
  {
    icon: ClipboardCheck,
    label: "Admin Dashboard",
    view: "admin",
    activeViews: ["admin", "details", "report"],
    roles: ["admin", "super_admin"],
  },
  {
    icon: LayoutDashboard,
    label: "Client Directory",
    view: "directory",
    activeViews: ["directory", "details", "report"],
    roles: ["employee", "verifier"],
  },
  {
    icon: CreditCard,
    label: "Payment Verification",
    view: "payments",
    activeViews: ["payments"],
    roles: ["verifier", "admin", "super_admin"],
  },
  {
    icon: BarChart3,
    label: "Data Analysis",
    view: "analysis",
    activeViews: ["analysis"],
    roles: ["admin", "super_admin"],
  },
  {
    icon: MonitorCheck,
    label: "Employee Activity",
    view: "activity",
    activeViews: ["activity"],
    roles: ["admin", "super_admin"],
  },
  {
    icon: Clock3,
    label: "Employee Timing",
    view: "timing",
    activeViews: ["timing"],
    roles: ["admin", "super_admin"],
  },
  {
    icon: AlertTriangle,
    label: "Unusual Entries",
    view: "unusual",
    activeViews: ["unusual"],
    roles: ["admin", "super_admin"],
  },
  {
    icon: UsersRound,
    label: "Users",
    view: "users",
    activeViews: ["users"],
    roles: ["admin"],
  },
];

export function Sidebar({ view = "directory", setView, isOpen, isCollapsed = false, toggleCollapsed, onOpenSettings, closeSidebar, user }) {
  const closeOnSmallScreens = () => {
    if (window.innerWidth < 1024) {
      closeSidebar();
    }
  };

  const handleNavClick = (newView) => {
    setView(newView);
    closeOnSmallScreens();
  };

  const handleSettingsClick = () => {
    onOpenSettings?.();
    closeOnSmallScreens();
  };

  const handleSupportClick = () => {
    toast.info("Support Hub Opened");
    closeOnSmallScreens();
  };

  return (
    <div className={cn(
      "sidebar-shell h-screen flex flex-col shrink-0 fixed lg:relative z-[60] lg:z-20",
      isOpen ? "sidebar-open shadow-2xl lg:shadow-xl" : "sidebar-closed",
      isCollapsed && "sidebar-collapsed"
    )}>
      <div className={cn(
        "sidebar-brand-block p-5 sm:p-6 mb-2 sm:mb-4 flex items-start justify-between gap-3",
        isCollapsed && "lg:items-center lg:justify-center lg:px-3"
      )}>
        <div className={cn("sidebar-brand-identity", isCollapsed && "sidebar-brand-identity-collapsed")}>
          <div className={cn("nz-britannia-sidebar-logo", isCollapsed && "nz-britannia-sidebar-logo-compact")}>
            <img
              className="brand-logo-light"
              src={isCollapsed ? NZBritanniaMark : NZBritanniaLogo}
              alt={isCollapsed ? "NZ Britannia" : "NZ Britannia — Retire Better"}
            />
            <img
              className="brand-logo-dark"
              src={isCollapsed ? NZBritanniaMarkWhite : NZBritanniaLogoWhite}
              alt=""
              aria-hidden="true"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? "Expand navigation menu" : "Collapse navigation menu"}
          title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
          className="hidden lg:flex h-9 w-9 min-h-9 min-w-9 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white/70 shadow-sm hover:bg-white/15 hover:text-white active:scale-95"
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button
          type="button"
          onClick={closeSidebar}
          aria-label="Close navigation menu"
          className="lg:hidden rounded-lg border border-white/10 bg-white/10 p-2 text-white/70 shadow-sm hover:bg-white/15 hover:text-white active:scale-95"
        >
          <X size={18} />
        </button>
        <BrandRail className="sidebar-brand-rail" />
      </div>

      <nav className={cn("flex-1 space-y-1 overflow-y-auto", isCollapsed ? "px-2" : "px-3")}>
        <div className={cn("px-4 mb-2 text-[10px] font-black text-white/35 uppercase tracking-widest", isCollapsed && "lg:sr-only")}>
          Main Navigation
        </div>
        
        {navItems
          .filter((item) => item.roles.includes(user?.role))
          .map((item) => (
            <NavItem
              key={item.view}
              icon={item.icon}
              label={user?.role === "verifier" && item.view === "directory" ? "Verifier Dashboard" : item.label}
              active={item.activeViews.includes(view)}
              onClick={() => handleNavClick(item.view)}
              isOpen={!isCollapsed}
            />
          ))}
      </nav>

      <div className={cn("p-4 flex flex-col gap-1 border-t border-white/10 bg-black/8", isCollapsed && "lg:px-2")}>
        <button 
          type="button"
          onClick={handleSettingsClick}
          title={isCollapsed ? "Settings" : undefined}
          aria-label="Settings"
          className={cn(
            "flex items-center py-2.5 text-sm font-bold text-white/58 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all w-full",
            isCollapsed ? "lg:justify-center lg:px-0" : "gap-3 px-4"
          )}
        >
          <Settings size={18} />
          {!isCollapsed && <span>Settings</span>}
        </button>
        <button 
          type="button"
          onClick={handleSupportClick}
          title={isCollapsed ? "Support" : undefined}
          aria-label="Support"
          className={cn(
            "flex items-center py-2.5 text-sm font-bold text-white/58 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all w-full",
            isCollapsed ? "lg:justify-center lg:px-0" : "gap-3 px-4"
          )}
        >
          <HelpCircle size={18} />
          {!isCollapsed && <span>Support</span>}
        </button>
      </div>
    </div>
  );
}
