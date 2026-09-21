import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FileText, Menu, X, Monitor, User as UserIcon, LogOut } from "lucide-react";
import { toast } from "sonner";
import { NotificationCenter } from "./NotificationCenter";
import { BrandRail } from "./BrandRail";
import NZBritanniaMark from "../assets/nz-britannia-mark.png";
import NZBritanniaMarkWhite from "../assets/nz-britannia-mark-white.png";

export function Header({ view = "directory", viewTitle = "Comprehensive Client Record", setView, toggleSidebar, isSidebarOpen = false, isSettingsOpen, setIsSettingsOpen, user, onLogout }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [draftCount, setDraftCount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("counttale_invoice_drafts") || "[]").length;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    if (!isProfileOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsProfileOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isProfileOpen]);

  useEffect(() => {
    const syncDraftCount = () => {
      try {
        setDraftCount(JSON.parse(localStorage.getItem("counttale_invoice_drafts") || "[]").length);
      } catch {
        setDraftCount(0);
      }
    };
    syncDraftCount();
    window.addEventListener("storage", syncDraftCount);
    window.addEventListener("counttale:drafts-updated", syncDraftCount);
    return () => {
      window.removeEventListener("storage", syncDraftCount);
      window.removeEventListener("counttale:drafts-updated", syncDraftCount);
    };
  }, []);

  const settingsDrawer = isSettingsOpen ? createPortal(
    <>
      <div className="fixed inset-0 glass-backdrop z-[240]" onClick={() => setIsSettingsOpen(false)} />
      <div className="fixed top-0 right-0 h-full w-[min(24rem,100vw)] glass-panel z-[250] motion-drawer border-l border-[var(--ct-line)] flex flex-col">
        <div className="p-6 border-b border-[var(--ct-line)] flex justify-between items-center bg-[var(--ct-cream)]/80 backdrop-blur-2xl">
          <div>
            <h2 className="text-lg font-black text-slate-900">System Settings</h2>
            <p className="text-xs text-slate-500 font-medium">Manage your workspace preferences</p>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            aria-label="Close settings"
            className="ui-icon-btn"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Appearance</h3>
            <div className="flex w-full items-center justify-between rounded-lg border border-[var(--ct-green-700)] bg-[var(--ct-green-50)] p-4 text-left">
              <div className="flex items-center gap-3">
                <Monitor size={18} className="text-[var(--ct-green-700)]" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Bright Theme</p>
                  <p className="text-xs text-slate-500">Warm, soothing workspace colours</p>
                </div>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--ct-green-700)]">Active</span>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-[var(--ct-line)] bg-[var(--ct-cream)]/70 backdrop-blur-2xl">
          <button className="ui-btn ui-btn-md ui-btn-primary w-full" onClick={() => { setIsSettingsOpen(false); toast.success("Settings saved successfully!"); }}>
            Save Preferences
          </button>
        </div>
      </div>
    </>,
    document.body
  ) : null;

  const profileDrawer = isProfileOpen ? createPortal(
    <>
      <div
        className="fixed inset-0 glass-backdrop z-[240]"
        onClick={() => setIsProfileOpen(false)}
        aria-hidden="true"
      />
      <aside
        className="profile-drawer-panel fixed inset-y-0 right-0 z-[250] flex w-[min(22rem,100vw)] flex-col border-l border-[var(--ct-line)] bg-white motion-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-drawer-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--ct-line)] bg-[var(--ct-green-50)] px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ct-green-700)]">Account</p>
            <h2 id="profile-drawer-title" className="mt-1 text-lg font-black text-slate-900">Profile &amp; access</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsProfileOpen(false)}
            aria-label="Close profile panel"
            className="ui-icon-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-center gap-4 border-b border-[var(--ct-line)] pb-6">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--ct-line)] bg-slate-100">
              <img
                src={user.avatar}
                alt={`${user.name} profile`}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=e2e8f0";
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-900">{user.name}</p>
              <p className="mt-0.5 truncate text-sm text-slate-500">{user.email || user.designation}</p>
              <span className="mt-2 inline-flex rounded-full bg-[var(--ct-green-50)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--ct-green-700)]">
                {user.designation}
              </span>
            </div>
          </div>

          <div className="pt-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Account options</p>
            <button
              type="button"
              onClick={() => { setView("profile"); setIsProfileOpen(false); }}
              className="flex w-full items-center gap-3 rounded-lg border border-[var(--ct-line)] bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 transition-colors hover:border-[var(--ct-green-200)] hover:bg-[var(--ct-green-50)] hover:text-slate-900"
            >
              <UserIcon size={18} className="text-[var(--ct-green-700)]" />
              <span>
                <span className="block">View profile</span>
                <span className="mt-0.5 block text-xs font-medium text-slate-500">Personal details and password settings</span>
              </span>
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--ct-line)] bg-slate-50 px-6 py-5">
          <button
            type="button"
            onClick={() => { setIsProfileOpen(false); onLogout?.(); }}
            className="ui-btn ui-btn-md ui-btn-secondary w-full justify-center text-rose-600 hover:border-rose-200 hover:bg-rose-50"
          >
            <LogOut size={17} />
            Log out
          </button>
        </div>
      </aside>
    </>,
    document.body
  ) : null;

  return (
    <>
    <header className="ct-topbar h-16 flex items-center justify-between px-4 md:px-8 shrink-0 relative z-30 w-full">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          aria-label="Open navigation menu"
          aria-expanded={isSidebarOpen}
          className="lg:hidden p-2 hover:bg-[var(--ct-green-50)] rounded-lg text-slate-500 transition-all active:scale-95"
        >
          <Menu size={20} />
        </button>
        <span className="topbar-brand-mark lg:hidden">
          <img className="brand-logo-light" src={NZBritanniaMark} alt="NZ Britannia" />
          <img className="brand-logo-dark" src={NZBritanniaMarkWhite} alt="" aria-hidden="true" />
        </span>
        <h2 className="ct-topbar-title text-xs md:text-sm font-black text-slate-900 tracking-wide uppercase truncate max-w-[140px] md:max-w-none">
          {view === "directory" ? "Client Records" : viewTitle}
        </h2>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <div className="flex items-center gap-3 text-slate-500 sm:border-r sm:border-[var(--ct-line)] sm:pr-6">
          <button
            type="button"
            onClick={() => {
              setView("entry");
              toast.info(draftCount ? `${draftCount} saved draft${draftCount === 1 ? "" : "s"} available` : "No saved drafts yet");
            }}
            className="ui-icon-btn relative"
            title="Saved drafts"
            aria-label={`Saved drafts${draftCount ? `, ${draftCount} available` : ""}`}
          >
            <FileText size={17} />
            {draftCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ct-warm-gold)] px-1 text-[9px] font-black text-[var(--ct-deep-forest)] shadow-sm">
                {draftCount > 9 ? "9+" : draftCount}
              </span>
            )}
          </button>
          <NotificationCenter user={user} />
        </div>

        <button
          type="button"
          onClick={() => {
            setIsSettingsOpen(false);
            setIsProfileOpen((open) => !open);
          }}
          className="flex items-center gap-3 rounded-lg text-left group"
          aria-label="Open profile panel"
          aria-expanded={isProfileOpen}
          aria-haspopup="dialog"
        >
          <div className="w-9 h-9 rounded-lg bg-slate-200 border-2 border-white shadow-md overflow-hidden group-hover:ring-4 group-hover:ring-[rgba(7,107,82,0.14)] transition-all">
            <img 
              src={user.avatar} 
              alt="Avatar" 
              className="w-full h-full object-cover" 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=e2e8f0";
              }}
            />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-bold text-slate-900 group-hover:text-[var(--ct-green-700)] transition-colors">{user.name}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{user.designation}</p>
          </div>
        </button>

      </div>

      <BrandRail className="topbar-brand-rail" />

    </header>
    {settingsDrawer}
    {profileDrawer}
    </>
  );
}
