import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, FilePlus2, FileText, LogOut, Menu, Monitor, Play, Trash2, User as UserIcon, X } from "lucide-react";
import { toast } from "sonner";
import { NotificationCenter } from "./NotificationCenter";
import { BrandRail } from "./BrandRail";
import NZBritanniaMark from "../assets/nz-britannia-mark.png";
import NZBritanniaMarkWhite from "../assets/nz-britannia-mark-white.png";

const draftStorageKey = "counttale_invoice_drafts";

const readDrafts = () => {
  try {
    const savedDrafts = JSON.parse(localStorage.getItem(draftStorageKey) || "[]");
    return Array.isArray(savedDrafts)
      ? savedDrafts.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      : [];
  } catch {
    return [];
  }
};

const formatDraftTime = (value) => {
  if (!value) return "Saved recently";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function Header({ view = "directory", viewTitle = "Comprehensive Client Record", setView, toggleSidebar, isSidebarOpen = false, isSettingsOpen, setIsSettingsOpen, user, onLogout, onOpenDraft, onCreateInvoice }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [drafts, setDrafts] = useState(readDrafts);
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const draftCount = drafts.length;

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
    const syncDrafts = () => setDrafts(readDrafts());
    syncDrafts();
    window.addEventListener("storage", syncDrafts);
    window.addEventListener("counttale:drafts-updated", syncDrafts);
    return () => {
      window.removeEventListener("storage", syncDrafts);
      window.removeEventListener("counttale:drafts-updated", syncDrafts);
    };
  }, []);

  useEffect(() => {
    if (!isDraftsOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsDraftsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isDraftsOpen]);

  const removeDraft = (draftId) => {
    const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
    localStorage.setItem(draftStorageKey, JSON.stringify(nextDrafts));
    setDrafts(nextDrafts);
    setConfirmDeleteId("");
    window.dispatchEvent(new CustomEvent("counttale:drafts-updated"));
    toast.success("Draft removed");
  };

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

  const draftsDrawer = isDraftsOpen ? createPortal(
    <>
      <div
        className="fixed inset-0 glass-backdrop z-[240]"
        onClick={() => setIsDraftsOpen(false)}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-[250] flex w-[min(30rem,100vw)] flex-col border-l border-[var(--ct-line)] bg-white motion-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-drafts-title"
      >
        <div className="border-b border-[var(--ct-line)] bg-[var(--ct-green-50)] px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ct-green-700)]">Invoice workspace</p>
              <h2 id="saved-drafts-title" className="mt-1 text-xl font-black text-slate-900">Saved drafts</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">Choose a draft to continue without replacing your other saved work.</p>
            </div>
            <button type="button" onClick={() => setIsDraftsOpen(false)} className="ui-icon-btn" aria-label="Close saved drafts">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar sm:px-6">
          {drafts.length ? (
            <div className="space-y-3">
              {drafts.map((draft) => {
                const data = draft.formData || {};
                const isConfirmingDelete = confirmDeleteId === draft.id;
                return (
                  <article key={draft.id} className="rounded-xl border border-[var(--ct-line)] bg-white p-4 transition-colors hover:border-[var(--ct-green-200)]">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ct-green-50)] text-[var(--ct-green-700)]">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-900">{draft.title || "Untitled invoice draft"}</p>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500">
                          {data.journalNo ? `Journal ${data.journalNo}` : "Journal number not entered"}
                        </p>
                      </div>
                      <span className="ui-status-badge border-amber-100 bg-amber-50 text-amber-700">
                        {data.paymentStatus || "Unpaid"}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                      <CalendarClock size={14} />
                      <span>{formatDraftTime(draft.updatedAt)}</span>
                      {draft.autosaved && <span className="ml-auto text-[var(--ct-green-700)]">Autosaved</span>}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenDraft?.(draft);
                          setIsDraftsOpen(false);
                          setConfirmDeleteId("");
                          toast.success("Draft opened", {
                            description: draft.title || "Your saved invoice is ready to continue.",
                          });
                        }}
                        className="ui-btn ui-btn-sm ui-btn-primary flex-1 justify-center"
                      >
                        <Play size={14} />
                        Resume draft
                      </button>
                      {isConfirmingDelete ? (
                        <>
                          <button type="button" onClick={() => removeDraft(draft.id)} className="ui-btn ui-btn-sm ui-btn-danger">Delete</button>
                          <button type="button" onClick={() => setConfirmDeleteId("")} className="ui-btn ui-btn-sm ui-btn-secondary">Cancel</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteId(draft.id)} className="ui-icon-btn text-rose-600" aria-label={`Delete ${draft.title || "draft"}`}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--ct-green-50)] text-[var(--ct-green-700)]">
                <FileText size={22} />
              </div>
              <h3 className="mt-4 text-base font-black text-slate-900">No saved drafts</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Incomplete invoices will appear here after you save them or leave the form.</p>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--ct-line)] bg-slate-50 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => {
              onCreateInvoice?.();
              setIsDraftsOpen(false);
              setConfirmDeleteId("");
            }}
            className="ui-btn ui-btn-md ui-btn-secondary w-full justify-center"
          >
            <FilePlus2 size={17} />
            Start new invoice
          </button>
        </div>
      </aside>
    </>,
    document.body,
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
            onClick={() => setIsDraftsOpen(true)}
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
    {draftsDrawer}
    </>
  );
}
