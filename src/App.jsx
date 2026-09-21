import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { StatCard } from "./components/StatCard";
import { ClientTable } from "./components/ClientTable";
import { DataEntry } from "./components/DataEntry";
import { ClientDetails } from "./components/ClientDetails";
import { ClientReport } from "./components/ClientReport";
import { ProfileView } from "./components/ProfileView";
import { PaymentsView } from "./components/PaymentsView";
import { LoginPage } from "./components/LoginPage";
import { AdminUsers } from "./components/AdminUsers";
import { EmployeeActivity } from "./components/EmployeeActivity";
import { EmployeeTiming } from "./components/EmployeeTiming";
import { AdminDashboard } from "./components/AdminDashboard";
import { UnusualEntriesView } from "./components/UnusualEntriesView";
import { FinancialDataAnalysis } from "./components/FinancialDataAnalysis";
import { TaskLoader } from "./components/TaskLoader";
import { ActivityFeedback } from "./components/ActivityFeedback";
import { api } from "./services/api";
import NZBritanniaMark from "./assets/nz-britannia-mark.png";

import { CheckCircle2, ClipboardList, Database, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Toaster, toast } from "sonner";

const viewTitles = {
  directory: "Client Directory",
  admin: "Admin Dashboard",
  details: "Client Details",
  report: "Financial Analysis",
  profile: "System Profile",
  payments: "Payment Verification",
  analysis: "Financial Data Analysis",
  entry: "Data Entry",
  activity: "Employee Activity",
  timing: "Employee Timing",
  unusual: "Unusual Entries",
  "super-admin": "Super Admin",
  users: "User Management",
};

const isAdminUser = (user) => ["admin", "super_admin"].includes(user?.role);
const isSuperAdmin = (user) => user?.role === "super_admin";
const canCreate = (user) => user?.role === "employee";
const canVerify = (user) => ["admin", "super_admin"].includes(user?.role);
const minimumLoginLoadingMs = 450;
const isPartialPayment = (status) => status === "Partially Paid" || status === "Pending";
const viewLoadingType = {
  entry: "invoice",
  payments: "payment",
  analysis: "report",
  report: "report",
  activity: "activity",
  timing: "timing",
  unusual: "verify",
  users: "user",
  "super-admin": "user",
  profile: "profile",
  details: "record",
};

function App() {
  const [view, setView] = useState("directory");
  const [selectedClient, setSelectedClient] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024,
  );
  const [isLargeScreen, setIsLargeScreen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024,
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("counttale_sidebar_collapsed") === "true";
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const [isBooting, setIsBooting] = useState(Boolean(api.token));
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const previousView = useRef(view);

  useEffect(() => {
    if (!user || previousView.current === view) {
      previousView.current = view;
      return undefined;
    }

    previousView.current = view;
    const id = `view-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.dispatchEvent(new CustomEvent("nz:activity", {
      detail: { id, phase: "start", type: viewLoadingType[view] || "workspace" },
    }));
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("nz:activity", { detail: { id, phase: "finish" } }));
    }, 420);
    return () => window.clearTimeout(timer);
  }, [user, view]);

  useEffect(() => {
    const syncSidebarForViewport = () => {
      const largeScreen = window.innerWidth >= 1024;
      setIsLargeScreen(largeScreen);
      setIsSidebarOpen(largeScreen);
    };
    syncSidebarForViewport();
    window.addEventListener("resize", syncSidebarForViewport);
    return () => window.removeEventListener("resize", syncSidebarForViewport);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isSidebarOpen]);

  const loadWorkspace = useCallback(async () => {
    const invoicePayload = await api.invoices();
    setClients(invoicePayload.invoices);
  }, []);

  useEffect(() => {
    if (!api.token) return;
    let mounted = true;
    api
      .me()
      .then(async ({ user: currentUser }) => {
        if (!mounted) return;
        setUser(currentUser);
        if (isSuperAdmin(currentUser)) setView("super-admin");
        else if (isAdminUser(currentUser)) setView("admin");
        await loadWorkspace();
      })
      .catch(() => {
        api.logout();
        setUser(null);
      })
      .finally(() => mounted && setIsBooting(false));
    return () => {
      mounted = false;
    };
  }, [loadWorkspace]);

  const handleLogin = async (email, password) => {
    const loginStartedAt = Date.now();
    setIsLoginLoading(true);
    try {
      const payload = await api.login(email, password);
      setUser(payload.user);
      setView(isSuperAdmin(payload.user) ? "super-admin" : isAdminUser(payload.user) ? "admin" : "directory");
      await loadWorkspace();
      toast.success("Login successful", { description: `Welcome, ${payload.user.name}.` });
    } finally {
      const remainingLoadingTime = minimumLoginLoadingMs - (Date.now() - loginStartedAt);
      if (remainingLoadingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingLoadingTime));
      }
      setIsLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setClients([]);
    setSelectedClient(null);
    setView("directory");
    toast.success("Successfully logged out");
  };

  const handleAddInvoice = async (payload) => {
    const { invoice } = await api.createInvoice(payload);
    await loadWorkspace();
    return invoice;
  };

  const handleVerifyPayment = async (clientId, payload) => {
    const { invoice } = await api.updateStatus(clientId, payload);
    setClients((current) => current.map((client) => (client.id === invoice.id ? invoice : client)));
    setSelectedClient((current) => (current?.id === invoice.id ? invoice : current));
    return invoice;
  };

  const handleUpdateInvoice = async (clientId, payload) => {
    const { invoice } = await api.updateInvoice(clientId, payload);
    setClients((current) => current.map((client) => (client.id === invoice.id ? invoice : client)));
    setSelectedClient((current) => (current?.id === invoice.id ? invoice : current));
    return invoice;
  };

  const handleAdminReview = async (clientId, payload) => {
    const { invoice } = await api.reviewInvoice(clientId, payload);
    setClients((current) => current.map((client) => (client.id === invoice.id ? invoice : client)));
    setSelectedClient((current) => (current?.id === invoice.id ? invoice : current));
    return invoice;
  };

  const openDetails = async (client) => {
    try {
      const { invoice } = await api.invoice(client.id);
      setSelectedClient(invoice);
    } catch {
      setSelectedClient(client);
    }
    setView("details");
  };

  const totalClients = clients.length;
  const paidCount = clients.filter((client) => client.paymentStatus === "Paid").length;
  const unpaidCount = clients.filter((client) => client.paymentStatus === "Unpaid").length;
  const pendingCount = clients.filter((client) => isPartialPayment(client.paymentStatus)).length;
  const committedCount = clients.filter((client) => client.blockchain?.transactionId).length;

  const activeViewTitle = viewTitles[view] || "NZ Britannia";
  const homeView = isSuperAdmin(user) ? "super-admin" : isAdminUser(user) ? "admin" : "directory";

  const protectedNotice = useMemo(() => {
    if (view === "entry" && !canCreate(user)) return "Only employees can create normal invoice records. Admin focuses on review, approval, and monitoring.";
    if (view === "admin" && !isAdminUser(user)) return "The admin dashboard is available to administrators only.";
    if (view === "super-admin" && !isSuperAdmin(user)) return "The Super Admin dashboard is available to the owner account only.";
    if (view === "payments" && user?.role === "employee") return "Payment verification is available to Admin and Super Admin roles.";
    if (view === "activity" && !isAdminUser(user)) return "Employee activity monitoring is available to administrators only.";
    if (view === "timing" && !isAdminUser(user)) return "Employee timing is available to administrators only.";
    if (view === "unusual" && !isAdminUser(user)) return "Unusual entry monitoring is available to administrators only.";
    if (view === "users" && !isAdminUser(user)) return "User management is available to administrators only.";
    return "";
  }, [user, view]);

  if (isBooting) {
    return (
      <div className="min-h-screen bg-[var(--ct-cream)] soft-animated-bg flex items-center justify-center">
        <TaskLoader type="workspace" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="bottom-right" richColors className="counttale-toast" />
        <ActivityFeedback />
        <LoginPage onLogin={handleLogin} isLoading={isLoginLoading} />
      </>
    );
  }

  return (
    <div className="app-shell h-screen overflow-hidden text-[var(--ct-ink)] font-sans soft-animated-bg lg:flex">
      <Toaster position="bottom-right" richColors className="counttale-toast" />
      <ActivityFeedback />
      <Sidebar
        view={view}
        setView={setView}
        isOpen={isSidebarOpen}
        isCollapsed={isLargeScreen && isSidebarCollapsed}
        toggleCollapsed={() => {
          setIsSidebarCollapsed((current) => {
            const next = !current;
            localStorage.setItem("counttale_sidebar_collapsed", String(next));
            return next;
          });
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        closeSidebar={() => setIsSidebarOpen(false)}
        user={user}
      />
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm z-[50] lg:hidden motion-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="min-w-0 h-full flex flex-col overflow-hidden relative w-full lg:flex-1">
        <Header
          view={view}
          setView={setView}
          viewTitle={activeViewTitle}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          user={user}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-auto bg-transparent relative z-0 custom-scrollbar">
          {protectedNotice ? (
            <div className="ct-page p-4 sm:p-6 lg:p-8 motion-page">
              <div className="mx-auto max-w-xl premium-card p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[rgba(200,168,106,0.28)] bg-[rgba(200,168,106,0.12)] text-[var(--ct-gold)]">
                  <ShieldCheck size={22} />
                </div>
                <h1 className="text-xl font-black text-[var(--ct-ink)]">Access Restricted</h1>
                <p className="mt-2 text-sm font-medium text-[var(--ct-muted)]">{protectedNotice}</p>
                <button
                  onClick={() => setView(homeView)}
                  className="ui-btn ui-btn-md ui-btn-primary mt-6"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : view === "admin" ? (
            <AdminDashboard
              clients={clients}
              onReviewRecord={handleAdminReview}
              onVerifyPayment={canVerify(user) ? handleVerifyPayment : null}
              onViewDetails={openDetails}
              onViewReport={(client) => {
                setSelectedClient(client);
                setView("report");
              }}
            />
          ) : view === "directory" ? (
            <div className="ct-page p-4 sm:p-6 lg:p-8 motion-page">
              <div className="max-w-[1600px] mx-auto space-y-8">
                <section className="ct-hero">
                  <div className="ct-hero-content">
                    <div className="ct-eyebrow">
                      <ShieldCheck size={14} />
                      NZ Britannia Financial Ledger
                    </div>
                    <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">
                      Every client record, traceable.
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-white/68">
                      Follow every invoice from entry to payment, verification, responsibility, and trusted ledger trace.
                    </p>
                    <div className="ct-hero-trace-grid">
                      {[
                        ["Records", totalClients],
                        ["Paid", paidCount],
                        ["Partial", pendingCount],
                        ["Unpaid", unpaidCount],
                      ].map(([label, value]) => (
                        <div key={label} className="ct-hero-trace">
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ct-hero-panel">
                    <div className="ct-hero-logo">
                      <img src={NZBritanniaMark} alt="" aria-hidden="true" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">Record Trail</p>
                    <div className="mt-5 space-y-3">
                      {[
                        ["Entry Owner", user?.name || "Current user"],
                        ["Verification", `${pendingCount + unpaidCount} open`],
                        ["Ledger Stored", committedCount],
                      ].map(([label, value]) => (
                        <div key={label} className="ct-hero-ledger-row">
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:flex-col">
                      {canCreate(user) && (
                        <button
                          onClick={() => setView("entry")}
                          className="ui-btn ui-btn-md ct-hero-action"
                        >
                          <UserPlus size={18} />
                          Add New Invoice
                        </button>
                      )}
                      {canVerify(user) && (
                        <button
                          onClick={() => setView("analysis")}
                          className="ui-btn ui-btn-md ct-hero-secondary"
                        >
                          <Database size={18} />
                          Financial Analysis
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  <StatCard
                    title="Total Records"
                    value={totalClients}
                    subtext={<span className="text-emerald-500 font-bold">Live Data</span>}
                    icon={Users}
                    colorClass="ct-stat-tone-navy"
                  />
                  <StatCard
                    title="Paid"
                    value={paidCount}
                    subtext="Verified payment records"
                    icon={CheckCircle2}
                    colorClass="ct-stat-tone-success"
                  />
                  <StatCard
                    title="Partially Paid / Unpaid"
                    value={pendingCount + unpaidCount}
                    subtext={`${pendingCount} partially paid, ${unpaidCount} unpaid`}
                    icon={ClipboardList}
                    colorClass="ct-stat-tone-danger"
                  />
                  <StatCard
                    title="Fabric Committed"
                    value={committedCount}
                    subtext="Paid summaries on ledger"
                    icon={Database}
                    colorClass="ct-stat-tone-sky"
                  />
                </div>

                <ClientTable
                  key={tableSearchQuery || "all-clients"}
                  clients={clients}
                  setClients={setClients}
                  externalSearchQuery={tableSearchQuery}
                  user={user}
                  onUpdateInvoice={handleUpdateInvoice}
                  onVerifyPayment={canVerify(user) ? handleVerifyPayment : null}
                  onViewDetails={openDetails}
                  onViewReport={(client) => {
                    setSelectedClient(client);
                    setView("report");
                  }}
                />
              </div>
            </div>
          ) : view === "details" && selectedClient ? (
            <div className="flex-1 bg-transparent">
              <ClientDetails
                client={selectedClient}
                onViewReport={(client) => {
                  setSelectedClient(client);
                  setView("report");
                }}
                onBack={() => {
                  setView(homeView);
                  setSelectedClient(null);
                }}
              />
            </div>
          ) : view === "report" && selectedClient ? (
            <div className="flex-1 bg-transparent">
              <ClientReport
                client={selectedClient}
                onBack={() => {
                  setView(homeView);
                  setSelectedClient(null);
                }}
                onViewDetails={(client) => {
                  setSelectedClient(client);
                  setView("details");
                }}
              />
            </div>
          ) : view === "payments" ? (
            <PaymentsView
              clients={clients}
              user={user}
              onVerifyPayment={canVerify(user) ? handleVerifyPayment : null}
              onViewInDirectory={(client) => {
                setTableSearchQuery(client.name);
                setView(homeView);
              }}
            />
          ) : view === "timing" ? (
            <EmployeeTiming />
          ) : view === "entry" ? (
            <DataEntry clients={clients} onBack={() => setView("directory")} onAddClient={handleAddInvoice} />
          ) : view === "analysis" ? (
            <FinancialDataAnalysis clients={clients} onViewDetails={openDetails} />
          ) : view === "super-admin" ? (
            <AdminUsers currentUser={user} />
          ) : view === "activity" ? (
            <EmployeeActivity />
          ) : view === "unusual" ? (
            <UnusualEntriesView />
          ) : view === "users" ? (
            <AdminUsers currentUser={user} />
          ) : (
            <ProfileView user={user} setUser={setUser} onBack={() => setView("directory")} onLogout={handleLogout} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
