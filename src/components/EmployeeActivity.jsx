import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowDownUp,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  MonitorCheck,
  Search,
  Send,
  ShieldCheck,
  Users,
  Wifi,
  X,
  XCircle,
} from "lucide-react";
import { api } from "../services/api";
import { cn } from "../lib/utils";
import { downloadFormattedExcel, objectsToRows } from "../lib/exportCsv";
import { toast } from "sonner";
import { TaskLoader } from "./TaskLoader";

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "Not seen");

const statusClass = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Inactive: "bg-slate-100 text-slate-600 border-slate-200",
  "In Office": "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Remote / Unverified": "bg-amber-50 text-amber-700 border-amber-100",
  "Location Permission Enabled": "bg-blue-50 text-blue-700 border-blue-100",
  Unknown: "bg-slate-100 text-slate-600 border-slate-200",
  "Trusted Session": "bg-blue-50 text-blue-700 border-blue-100",
  "No Active Session": "bg-slate-100 text-slate-600 border-slate-200",
  "Device Changed": "bg-rose-50 text-rose-700 border-rose-100",
  "Session Mismatch": "bg-rose-50 text-rose-700 border-rose-100",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Verified: "bg-blue-50 text-blue-700 border-blue-100",
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Rejected: "bg-rose-50 text-rose-700 border-rose-100",
  Flagged: "bg-orange-50 text-orange-700 border-orange-100",
  Updated: "bg-blue-50 text-blue-700 border-blue-100",
  Finalized: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Committed: "bg-blue-50 text-blue-700 border-blue-100",
  Correction: "bg-amber-50 text-amber-700 border-amber-100",
  Normal: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Late Entry": "bg-amber-50 text-amber-700 border-amber-100",
  "Outside Office Entry": "bg-orange-50 text-orange-700 border-orange-100",
  "Duplicate Journal Attempt": "bg-rose-50 text-rose-700 border-rose-100",
  "Unusual Update After Verification": "bg-indigo-50 text-indigo-700 border-indigo-100",
  "Inactive User Activity": "bg-slate-100 text-slate-600 border-slate-200",
  "Multiple Failed Attempts": "bg-rose-50 text-rose-700 border-rose-100",
  "Edited After Payment Confirmation": "bg-amber-50 text-amber-700 border-amber-100",
  "Unusual Activity": "bg-orange-50 text-orange-700 border-orange-100",
};

const getPrimaryStatus = (activity) => activity.status || activity.activeStatus || "Completed";

const compactRecordId = (value) => {
  if (!value) return "System";
  if (String(value).length <= 14) return value;
  return `${String(value).slice(0, 8)}...`;
};

const ActivityStatusBadge = ({ value }) => (
  <span className={cn("ui-status-badge", statusClass[value] || statusClass.Unknown)}>
    {value || "Unknown"}
  </span>
);

const getIssueType = (activity) => activity.issueType || (activity.unusualReason ? "Unusual Activity" : "Normal");

const formatAmount = (value, currency = "BTN") => {
  const number = Number(value || 0);
  if (!number) return "Not recorded";
  return `${currency} ${number.toLocaleString()}`;
};

const DetailLine = ({ label, value, mono = false, full = false }) => (
  <div className={cn("rounded-2xl border border-slate-100 bg-white/75 p-4", full && "sm:col-span-2")}>
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className={cn("mt-1 text-sm font-bold text-slate-900", mono && "font-mono text-xs break-all")}>{value || "Not recorded"}</p>
  </div>
);

const TimelineItem = ({ item, compact = false }) => {
  const primaryStatus = getPrimaryStatus(item);
  return (
    <li className="group relative pl-9">
      <span className="absolute left-[0.42rem] top-9 bottom-[-1.35rem] w-px bg-slate-200 group-last:hidden" />
      <span className="absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-blue-100 bg-white shadow-sm">
        <span className="h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_0_4px_rgba(37,99,235,0.10)]" />
      </span>
      <div className="activity-feed-row rounded-[1.15rem] border border-slate-100/90 bg-white/70 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-100 hover:bg-white hover:shadow-lg hover:shadow-slate-200/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-slate-950">{item.employeeName || "System User"}</p>
              <ActivityStatusBadge value={primaryStatus} />
              {item.officeStatus && <ActivityStatusBadge value={item.officeStatus} />}
            </div>
            <p className="mt-1 text-sm font-bold leading-5 text-slate-700">{item.actionPerformed || item.action || "Activity recorded"}</p>
            {!compact && item.remarks && <p className="mt-2 text-xs leading-5 text-slate-500">{item.remarks}</p>}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[10px] font-black text-slate-600">
              <FileText size={12} />
              Record {compactRecordId(item.recordId)}
            </span>
            <span className="font-mono text-[10px] font-bold text-slate-400">{formatDateTime(item.entryTime)}</span>
          </div>
        </div>
      </div>
    </li>
  );
};

const MetricTile = ({ title, value, icon: Icon, tone = "slate", subtext }) => {
  const tones = {
    slate: "bg-slate-950 text-white",
    emerald: "bg-emerald-600 text-white",
    blue: "bg-blue-700 text-white",
    amber: "bg-amber-500 text-white",
    rose: "bg-rose-600 text-white",
  };
  return (
    <div className="premium-card premium-card-hover rounded-[1.35rem] p-5">
      <div className={cn("metric-icon flex h-11 w-11 items-center justify-center rounded-2xl shadow-inner", tones[tone])}>
        <Icon size={20} />
      </div>
      <p className="mt-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
      {subtext && <p className="mt-1 text-xs font-medium text-slate-500">{subtext}</p>}
    </div>
  );
};

const SelectFilter = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="premium-input ui-select mt-2 w-full rounded-2xl px-3 py-2.5 text-xs font-black text-slate-900 outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

export function EmployeeActivity() {
  const [summary, setSummary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [filters, setFilters] = useState({
    q: "",
    date: new Date().toISOString().slice(0, 10),
    employee: "",
    department: "All",
    role: "All",
    officeStatus: "All",
    activityType: "All",
  });
  const [sort, setSort] = useState({ key: "entryTime", direction: "desc" });
  const [isLoading, setIsLoading] = useState(true);
  const [isAllActivityOpen, setIsAllActivityOpen] = useState(false);
  const [activityDetails, setActivityDetails] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("activity");
  const filtersRef = useRef(filters);
  const hasOpenModal = Boolean(isAllActivityOpen || activityDetails);

  const loadActivity = async (activeFilters = filtersRef.current, showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const payload = await api.employeeActivitySummary(activeFilters);
      setSummary(payload);
      setActivities(payload.activities || []);
    } catch (error) {
      toast.error("Activity data unavailable", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    api
      .employeeActivitySummary(filtersRef.current)
      .then((payload) => {
        if (!mounted) return;
        setSummary(payload);
        setActivities(payload.activities || []);
      })
      .catch((error) => {
        if (mounted) toast.error("Activity data unavailable", { description: error.message });
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    const interval = window.setInterval(() => loadActivity(filtersRef.current, false), 30000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!hasOpenModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasOpenModal]);

  const setFilter = (key, value) => {
    const next = { ...filters, [key]: value };
    filtersRef.current = next;
    setFilters(next);
    loadActivity(next);
  };

  const sortedActivities = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...activities].sort((a, b) => {
      const av = a[sort.key] || "";
      const bv = b[sort.key] || "";
      if (sort.key === "entryTime" || sort.key === "lastSeen") {
        return (new Date(av).getTime() - new Date(bv).getTime()) * direction;
      }
      return String(av).localeCompare(String(bv)) * direction;
    });
  }, [activities, sort]);

  const recentActivities = useMemo(() => {
    const timeline = summary?.recentTimeline?.length ? summary.recentTimeline : sortedActivities;
    return [...timeline]
      .sort((a, b) => new Date(b.entryTime || 0).getTime() - new Date(a.entryTime || 0).getTime())
      .slice(0, 7);
  }, [summary, sortedActivities]);
  const unusualByEmployee = useMemo(() => {
    const grouped = new Map();
    for (const item of summary?.unusualEntries || []) {
      const key = item.employeeId || item.employeeName || "unknown";
      const existing = grouped.get(key) || {
        id: item.employeeId,
        name: item.employeeName || "Unknown Employee",
        role: item.roleLabel || item.role || "Employee",
        count: 0,
        issues: new Set(),
        latest: "",
        latestEntry: item,
      };
      existing.count += 1;
      existing.issues.add(getIssueType(item));
      if (!existing.latest || new Date(item.entryTime || 0) > new Date(existing.latest || 0)) {
        existing.latest = item.entryTime || "";
        existing.latestEntry = item;
      }
      grouped.set(key, existing);
    }
    return [...grouped.values()]
      .map((item) => ({ ...item, issues: [...item.issues] }))
      .sort((a, b) => b.count - a.count);
  }, [summary]);

  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const openActivityDetails = async (activity) => {
    setActivityDetails({ activity, invoice: null });
    if (!activity.recordId) return;
    setIsDetailLoading(true);
    try {
      const { invoice } = await api.invoice(activity.recordId);
      setActivityDetails({ activity, invoice });
    } catch {
      setActivityDetails({ activity, invoice: null });
    } finally {
      setIsDetailLoading(false);
    }
  };

  const exportRows = () => {
    const rows = sortedActivities.map((activity) => ({
      "Employee Name": activity.employeeName,
      Role: activity.roleLabel,
      "Action Performed": activity.actionPerformed,
      "Record/Invoice ID": activity.recordId,
      "Entry Time": formatDateTime(activity.entryTime),
      "Office Status": activity.officeStatus,
      "Device/Session Status": activity.deviceSessionStatus,
      "Active/Inactive Status": activity.activeStatus,
      "Last Seen": formatDateTime(activity.lastSeen),
      Remarks: activity.remarks,
    }));
    downloadFormattedExcel(`NZ_Britannia_Employee_Activity_${new Date().toISOString().slice(0, 10)}.xls`, objectsToRows(rows), {
      title: "Employee Activity Register",
      subtitle: "Formatted activity trail with employee, action, office presence, session, and remarks.",
      sheetName: "Employee Activity",
    });
    toast.success("Employee activity exported", { description: "Formatted activity workbook generated." });
  };

  const notifyEmployeeAboutIssues = async (employee) => {
    if (!employee.id) {
      toast.error("Employee unavailable", { description: "This activity row is missing the employee account reference." });
      return;
    }
    try {
      await api.sendNotification({
        target: employee.id,
        title: "Entry quality review needed",
        message: `Please review your recent entries. ${employee.count} unusual or sloppy entry pattern${employee.count === 1 ? "" : "s"} detected: ${employee.issues.join(", ")}.`,
      });
      toast.success("Notification sent", { description: `${employee.name} will see it in the notification center.` });
    } catch (error) {
      toast.error("Message failed", { description: error.message });
    }
  };

  const filterOptions = summary?.filters || {
    employees: [],
    departments: [],
    roles: [],
    officeStatuses: [],
    activityTypes: [],
  };
  const tabs = [
    { id: "activity", label: "Activity Table" },
    { id: "unusual", label: "Late or Unusual Entries" },
    { id: "inactive", label: "Inactive Employees" },
  ];

  return (
    <div className="ct-page p-4 sm:p-6 lg:p-8 max-w-[1700px] mx-auto space-y-8 motion-page pb-20">
      <div className="ct-section-hero flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <div className="ct-eyebrow">
            <MonitorCheck size={14} />
            Staff Monitoring
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-white">Employee Activity</h1>
          <p className="text-white/64 mt-2 max-w-2xl">
            Track accountability, office presence, active sessions, form submissions, and unusual activity.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => loadActivity(filters)}
            className="ui-btn ui-btn-md ct-hero-secondary"
          >
            Refresh
          </button>
          <button
            onClick={exportRows}
            className="ui-btn ui-btn-md ct-hero-action"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
        <MetricTile title="Live Active Employees" value={summary?.metrics?.liveActiveEmployees || 0} icon={Users} tone="emerald" />
        <MetricTile title="Today's Total Entries" value={summary?.metrics?.todaysTotalEntries || 0} icon={Activity} tone="blue" />
        <MetricTile title="Employees in Office" value={summary?.metrics?.employeesCurrentlyInOffice || 0} icon={Wifi} tone="slate" />
        <MetricTile title="Late or Unusual Entries" value={summary?.metrics?.unusualEntries || 0} icon={AlertTriangle} tone="amber" />
        <MetricTile title="Inactive Employees" value={summary?.metrics?.inactiveEmployees || 0} icon={Clock3} tone="rose" />
      </div>

      <section className="premium-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Entry Quality by Employee</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Unusual or Sloppy Entry Detection</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Grouped by employee so admins can quickly see who needs correction support.</p>
          </div>
          <span className="w-fit rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
            {unusualByEmployee.length} employees
          </span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {unusualByEmployee.slice(0, 6).map((employee) => (
            <article key={employee.id || employee.name} className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{employee.name}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{employee.role}</p>
                </div>
                <span className="rounded-full border border-white bg-white px-2.5 py-1 text-[10px] font-black text-amber-700">
                  {employee.count} issue{employee.count === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-3 text-xs font-bold leading-5 text-amber-900">{employee.issues.join(", ")}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] font-bold text-slate-500">{formatDateTime(employee.latest)}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => openActivityDetails(employee.latestEntry)} className="ui-btn ui-btn-sm ui-btn-secondary">
                    <Eye size={14} />
                    Details
                  </button>
                  <button type="button" onClick={() => notifyEmployeeAboutIssues(employee)} className="ui-btn ui-btn-sm ui-btn-primary">
                    <Send size={14} />
                    Notify
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!unusualByEmployee.length && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-700 lg:col-span-3">
              No unusual or sloppy entry patterns detected.
            </div>
          )}
        </div>
      </section>

      <section className="premium-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
              <History size={14} />
              Latest System Actions
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-950">Recent Activity Timeline</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
              The latest important actions are shown here so admins can spot new submissions, reviews, payment checks, and ledger events quickly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAllActivityOpen(true)}
            className="ui-btn ui-btn-md ui-btn-primary"
          >
            View All Activity
            <ArrowRight size={17} />
          </button>
        </div>

        <ol className="mt-6 grid gap-4 lg:grid-cols-2">
          {recentActivities.map((item) => (
            <TimelineItem key={item.id} item={item} compact />
          ))}
        </ol>

        {!recentActivities.length && (
          <div className="mt-6 rounded-[1.15rem] border border-slate-100 bg-white/70 p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <CheckCircle2 size={20} />
            </div>
            <p className="mt-3 text-sm font-black text-slate-900">{isLoading ? "Loading recent activity..." : "No recent activity yet"}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">New employee and admin actions will appear here automatically.</p>
          </div>
        )}
      </section>

      <div className="premium-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Filter size={18} className="text-blue-700" />
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Activity Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
          <label className="block xl:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search</span>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={filters.q}
                onChange={(event) => setFilter("q", event.target.value)}
                placeholder="Employee, action, record..."
                className="premium-input w-full rounded-2xl py-2.5 pl-10 pr-10 text-sm outline-none"
              />
              {filters.q && (
                <button
                  onClick={() => setFilter("q", "")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-950"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) => setFilter("date", event.target.value)}
              className="premium-input mt-2 w-full rounded-2xl px-3 py-2.5 text-xs font-black text-slate-900 outline-none"
            />
          </label>

          <SelectFilter
            label="Employee"
            value={filters.employee}
            onChange={(value) => setFilter("employee", value)}
            options={[
              { value: "", label: "All Employees" },
              ...filterOptions.employees.map((employee) => ({ value: employee.id, label: employee.name })),
            ]}
          />
          <SelectFilter
            label="Department"
            value={filters.department}
            onChange={(value) => setFilter("department", value)}
            options={[{ value: "All", label: "All Departments" }, ...filterOptions.departments.map((item) => ({ value: item, label: item }))]}
          />
          <SelectFilter
            label="Role"
            value={filters.role}
            onChange={(value) => setFilter("role", value)}
            options={[{ value: "All", label: "All Roles" }, ...filterOptions.roles.map((item) => ({ value: item, label: item }))]}
          />
          <SelectFilter
            label="Activity"
            value={filters.activityType}
            onChange={(value) => setFilter("activityType", value)}
            options={[{ value: "All", label: "All Activity" }, ...filterOptions.activityTypes.map((item) => ({ value: item, label: item }))]}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectFilter
            label="Office Status"
            value={filters.officeStatus}
            onChange={(value) => setFilter("officeStatus", value)}
            options={[{ value: "All", label: "All Office Statuses" }, ...filterOptions.officeStatuses.map((item) => ({ value: item, label: item }))]}
          />
        </div>
      </div>

      <div className="premium-card rounded-[1.35rem] p-4 sm:p-5">
        <div className="ui-tabs" role="tablist" aria-label="Employee activity sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className="ui-tab"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "activity" && (
        <section className="ui-tab-panel premium-card rounded-[1.35rem] overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Employee Activity Table</h2>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {isLoading ? "Loading activity..." : `${sortedActivities.length} records shown`}
              </p>
            </div>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Live refresh 30s
            </span>
          </div>

          <div className="ui-table-scroll custom-scrollbar">
            <table className="ui-table">
              <thead>
                <tr>
                  {[
                    ["employeeName", "Employee Name"],
                    ["recordId", "Record/Invoice ID"],
                    ["actionPerformed", "Action"],
                    ["entryTime", "Entry Time"],
                    ["officeStatus", "Office"],
                    ["activeStatus", "Status"],
                    ["issueType", "Risk / Unusual"],
                  ].map(([key, label]) => (
                    <th key={key}>
                      <button
                        onClick={() => key !== "issueType" && toggleSort(key)}
                        className="no-motion inline-flex min-h-0 items-center gap-1 text-left hover:text-slate-900"
                      >
                        {label}
                        {key !== "issueType" && <ArrowDownUp size={12} />}
                      </button>
                    </th>
                  ))}
                  <th className="ui-action-cell">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {sortedActivities.map((activity) => (
                  <tr key={activity.id}>
                    <td>
                      <p className="font-black text-slate-900">{activity.employeeName}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{activity.roleLabel} / {activity.department}</p>
                    </td>
                    <td className="font-mono text-xs font-bold text-slate-600">{activity.recordId || "System"}</td>
                    <td>
                      <p className="max-w-[15rem] truncate font-bold text-slate-900" title={activity.actionPerformed}>{activity.actionPerformed}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{activity.activityType}</p>
                    </td>
                    <td className="font-mono text-xs text-slate-500">{formatDateTime(activity.entryTime)}</td>
                    <td>
                      <ActivityStatusBadge value={activity.officeStatus} />
                    </td>
                    <td>
                      <ActivityStatusBadge value={activity.activeStatus} />
                    </td>
                    <td>
                      <ActivityStatusBadge value={getIssueType(activity)} />
                    </td>
                    <td className="ui-action-cell">
                      <button
                        onClick={() => openActivityDetails(activity)}
                        className="ui-btn ui-btn-sm ui-btn-soft"
                      >
                        <Eye size={14} />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
                {!sortedActivities.length && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-sm font-bold text-slate-500">
                      No employee activity matches the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ui-card-list">
            {sortedActivities.map((activity) => (
              <div key={activity.id} className="ui-mobile-record hover:bg-white/70 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-slate-950">{activity.employeeName}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{activity.roleLabel} / {activity.department}</p>
                  </div>
                  <ActivityStatusBadge value={getIssueType(activity)} />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-800">{activity.actionPerformed}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-black uppercase tracking-widest text-slate-400">Record ID</p>
                    <p className="mt-1 font-mono font-bold text-slate-700">{activity.recordId || "System"}</p>
                  </div>
                  <div>
                    <p className="font-black uppercase tracking-widest text-slate-400">Entry Time</p>
                    <p className="mt-1 font-mono font-bold text-slate-600">{formatDateTime(activity.entryTime)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActivityStatusBadge value={activity.officeStatus} />
                  <ActivityStatusBadge value={activity.activeStatus} />
                </div>
                <button
                  onClick={() => openActivityDetails(activity)}
                  className="ui-btn ui-btn-sm ui-btn-soft mt-4 w-full"
                >
                  <Eye size={16} />
                  Details
                </button>
              </div>
            ))}
            {!sortedActivities.length && (
              <div className="px-6 py-16 text-center text-sm font-bold text-slate-500">
                No employee activity matches the selected filters.
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "unusual" && (
        <section className="ui-tab-panel space-y-6">
          <div className="premium-card rounded-[1.35rem] p-6" data-testid="late-unusual-entries">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="mt-0.5 text-amber-500" />
                <div>
                  <h2 className="text-lg font-black text-slate-900">Late or Unusual Entries</h2>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                    Compact accountability list for records needing attention.
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                {summary?.unusualEntries?.length || 0} Issues
              </span>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
              <table className="hidden w-full table-fixed text-left md:table">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Record ID</th>
                    <th className="px-4 py-3">Issue</th>
                    <th className="px-4 py-3">Entry Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/70 text-sm">
                  {(summary?.unusualEntries || []).slice(0, 6).map((item) => (
                    <tr key={item.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-900">{item.employeeName}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.department}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600" title={item.recordId || "System"}>
                        {compactRecordId(item.recordId)}
                      </td>
                      <td className="px-4 py-3">
                        <ActivityStatusBadge value={getIssueType(item)} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{formatDateTime(item.entryTime)}</td>
                      <td className="px-4 py-3">
                        <ActivityStatusBadge value={getPrimaryStatus(item)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openActivityDetails(item)}
                          className="ui-btn ui-btn-sm ui-btn-soft"
                        >
                          <Eye size={14} />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!summary?.unusualEntries?.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
                        No unusual entries detected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="md:hidden divide-y divide-slate-100 bg-white/70">
                {(summary?.unusualEntries || []).slice(0, 6).map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">{item.employeeName}</p>
                        <p className="mt-1 font-mono text-[10px] font-bold text-slate-400">{compactRecordId(item.recordId)}</p>
                      </div>
                      <ActivityStatusBadge value={getIssueType(item)} />
                    </div>
                    <p className="mt-3 font-mono text-[10px] font-bold text-slate-500">{formatDateTime(item.entryTime)}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <ActivityStatusBadge value={getPrimaryStatus(item)} />
                      <button
                        onClick={() => openActivityDetails(item)}
                        className="ui-btn ui-btn-sm ui-btn-soft"
                      >
                        <Eye size={14} />
                        Details
                      </button>
                    </div>
                  </div>
                ))}
                {!summary?.unusualEntries?.length && (
                  <div className="p-6 text-center text-sm font-bold text-slate-500">No unusual entries detected.</div>
                )}
              </div>
            </div>
          </div>

          <div className="premium-dark-panel rounded-[1.35rem] p-6 text-white">
            <div className="flex items-center gap-2 text-emerald-300">
              <ShieldCheck size={18} />
              <p className="text-[10px] font-black uppercase tracking-widest">Office Presence Logic</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Office status is checked using the configured office IP list, private office network signals, and optional location permission headers when available.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Device Check</p>
                <p className="mt-1 text-sm font-bold">Session and browser fingerprint match</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit Use</p>
                <p className="mt-1 text-sm font-bold">Internal accountability and attendance review</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "inactive" && (
        <section className="ui-tab-panel premium-card rounded-[1.35rem] p-6">
            <h2 className="text-lg font-black text-slate-900">Inactive Employees</h2>
            <div className="mt-5 space-y-3">
              {(summary?.inactiveEmployees || []).slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/70 p-4">
                  <div>
                    <p className="text-sm font-black text-slate-900">{item.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.department}</p>
                  </div>
                  <p className="text-[10px] font-mono font-bold text-slate-400 text-right">{formatDateTime(item.lastSeen)}</p>
                </div>
              ))}
              {!summary?.inactiveEmployees?.length && <p className="text-sm font-bold text-slate-500">No long-inactive employees.</p>}
            </div>
        </section>
      )}

      {isAllActivityOpen && createPortal(
        <div className="ui-modal-backdrop">
          <div className="glass-panel ui-modal-panel max-w-4xl motion-pop" role="dialog" aria-modal="true" aria-labelledby="full-history-title">
            <div className="ui-modal-header flex flex-col gap-4 border-b border-slate-200/70 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                  <History size={14} />
                  Full History
                </div>
                <h3 id="full-history-title" className="mt-3 text-2xl font-black text-slate-950">All Employee Activity</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Complete activity feed for the current filters, including user actions, record references, status, office presence, and timestamps.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAllActivityOpen(false)}
                className="self-start rounded-full bg-white p-2 text-slate-400 shadow-sm hover:text-slate-950"
                aria-label="Close full activity history"
              >
                <XCircle size={21} />
              </button>
            </div>

            <div className="ui-modal-body custom-scrollbar p-5 sm:p-6">
              <ol className="space-y-4">
                {sortedActivities.map((item) => (
                  <TimelineItem key={item.id} item={item} />
                ))}
              </ol>

              {!sortedActivities.length && (
                <div className="rounded-[1.15rem] border border-slate-100 bg-white/70 p-8 text-center">
                  <p className="text-sm font-black text-slate-900">No activity matches the current filters.</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">Adjust the filters to review more activity history.</p>
                </div>
              )}
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
              <button type="button" onClick={() => setIsAllActivityOpen(false)} className="ui-btn ui-btn-md ui-btn-secondary w-full sm:w-auto">
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {activityDetails && createPortal(
        <div className="ui-modal-backdrop">
          <div className="glass-panel ui-modal-panel employee-detail-modal max-w-5xl motion-pop" role="dialog" aria-modal="true" aria-labelledby="activity-details-title">
            <div className="ui-modal-header flex flex-col gap-4 border-b border-slate-200/70 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                  <AlertTriangle size={14} />
                  Activity Details
                </div>
                <h3 id="activity-details-title" className="mt-3 text-2xl font-black text-slate-950">
                  {activityDetails.invoice?.clientName || activityDetails.activity.actionPerformed}
                </h3>
            {isDetailLoading ? (
              <div className="mt-3">
                <TaskLoader type="record" compact />
              </div>
            ) : (
              <p className="mt-1 text-sm font-medium text-slate-500">
                Full accountability, timing, office, payment, blockchain, audit, and revision context.
              </p>
            )}
              </div>
              <button
                type="button"
                onClick={() => setActivityDetails(null)}
                className="self-start rounded-full bg-white p-2 text-slate-400 shadow-sm hover:text-slate-950"
                aria-label="Close activity details"
              >
                <XCircle size={21} />
              </button>
            </div>

            <div className="ui-modal-body custom-scrollbar p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[.9fr_1.1fr]">
                <section className="space-y-4">
                  <div className="premium-card rounded-[1.35rem] p-5">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Unusual Entry Summary</h4>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailLine label="Employee Name" value={activityDetails.activity.employeeName} />
                      <DetailLine label="Record ID" value={activityDetails.activity.recordId || "System"} mono />
                      <DetailLine label="Issue Type" value={getIssueType(activityDetails.activity)} />
                      <DetailLine label="Status" value={getPrimaryStatus(activityDetails.activity)} />
                      <DetailLine label="Entry Time" value={formatDateTime(activityDetails.activity.entryTime)} />
                      <DetailLine label="Last Seen" value={formatDateTime(activityDetails.activity.lastSeen)} />
                      <DetailLine label="Office Presence" value={activityDetails.activity.officeStatus} />
                      <DetailLine label="Device / Session" value={activityDetails.activity.deviceSessionStatus} />
                      <DetailLine label="Role / Department" value={`${activityDetails.activity.roleLabel || ""} / ${activityDetails.activity.department || ""}`} full />
                      <DetailLine label="Late or Unusual Reason" value={activityDetails.activity.unusualReason || "No issue reason recorded."} full />
                      <DetailLine label="Remarks" value={activityDetails.activity.remarks} full />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  {activityDetails.invoice ? (
                    <>
                      <div className="premium-card rounded-[1.35rem] p-5">
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Linked Invoice Details</h4>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <DetailLine label="Client / Invoice" value={activityDetails.invoice.clientName} />
                          <DetailLine label="Invoice Amount" value={formatAmount(activityDetails.invoice.invoiceAmount, activityDetails.invoice.currency)} />
                          <DetailLine label="Entered By" value={activityDetails.invoice.enteredByName || activityDetails.invoice.submittedByName} />
                          <DetailLine label="Employee Role / Department" value={`${activityDetails.invoice.enteredByRole || activityDetails.invoice.submittedByRole || ""} / ${activityDetails.invoice.enteredByDepartment || activityDetails.invoice.submittedByDepartment || ""}`} />
                          <DetailLine label="Entry Date & Time" value={formatDateTime(activityDetails.invoice.entryDateTime)} />
                          <DetailLine label="Office Presence" value={activityDetails.invoice.officePresenceStatus} />
                          <DetailLine label="Device / Session Status" value={activityDetails.invoice.entryDeviceStatus} />
                          <DetailLine label="Payment Status" value={activityDetails.invoice.paymentStatus} />
                          <DetailLine label="Journal Number" value={activityDetails.invoice.journalNo} mono />
                          <DetailLine label="Verified By" value={activityDetails.invoice.verifiedByName} />
                          <DetailLine label="Verified Date & Time" value={formatDateTime(activityDetails.invoice.verifiedAt)} />
                          <DetailLine label="Approved By" value={activityDetails.invoice.approvedByName || "Not approved"} />
                          <DetailLine label="Approved Date & Time" value={formatDateTime(activityDetails.invoice.approvedAt)} />
                          <DetailLine label="Last Updated By" value={activityDetails.invoice.lastUpdatedByName} />
                          <DetailLine label="Last Updated Date & Time" value={formatDateTime(activityDetails.invoice.lastUpdatedAt)} />
                          <DetailLine label="Blockchain Status" value={activityDetails.invoice.blockchainStorageStatus} />
                          <DetailLine label="Transaction Hash" value={activityDetails.invoice.blockchain?.transactionId || activityDetails.invoice.originalBlockchainTransactionHash} mono full />
                          <DetailLine label="Duplicate Warning" value={activityDetails.invoice.duplicateJournalWarning} />
                          <DetailLine label="Remarks" value={activityDetails.invoice.auditNotes || activityDetails.invoice.adminReviewRemarks || activityDetails.invoice.verificationRemarks} full />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <div className="premium-card rounded-[1.35rem] p-5">
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Audit History</h4>
                          <div className="mt-4 space-y-3">
                            {(activityDetails.invoice.audit || []).slice(0, 5).map((entry) => (
                              <div key={entry.id} className="rounded-2xl border border-slate-100 bg-white/75 p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-900">{entry.action}</p>
                                <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{entry.details}</p>
                                <p className="mt-2 text-[10px] font-mono font-bold text-slate-400">{formatDateTime(entry.createdAt)} / {entry.actorName}</p>
                              </div>
                            ))}
                            {!activityDetails.invoice.audit?.length && <p className="text-sm font-bold text-slate-500">No audit history attached.</p>}
                          </div>
                        </div>
                        <div className="premium-card rounded-[1.35rem] p-5">
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Revision History</h4>
                          <div className="mt-4 space-y-3">
                            {(activityDetails.invoice.revisionHistory || activityDetails.invoice.corrections || []).slice(0, 5).map((entry) => (
                              <div key={entry.id} className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-amber-800">{entry.correctionType || "Revision"}</p>
                                <p className="mt-2 text-xs font-semibold leading-5 text-amber-900">{entry.reason || "No reason recorded."}</p>
                                <p className="mt-2 text-[10px] font-mono font-bold text-amber-700">{formatDateTime(entry.createdAt)} / {entry.createdByName}</p>
                              </div>
                            ))}
                            {!(activityDetails.invoice.revisionHistory || activityDetails.invoice.corrections || []).length && (
                              <p className="text-sm font-bold text-slate-500">No revisions submitted.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="premium-card rounded-[1.35rem] p-5">
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Linked Invoice Details</h4>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {isDetailLoading ? (
                            <div className="sm:col-span-2">
                              <TaskLoader type="record" />
                            </div>
                          ) : (
                            <DetailLine label="Client / Invoice" value="No linked invoice record was found" />
                          )}
                          <DetailLine label="Payment Status" value="Not recorded" />
                          <DetailLine label="Journal Number" value={activityDetails.activity.recordId || "System"} mono />
                          <DetailLine label="Verified By" value="Not verified" />
                          <DetailLine label="Verified Date & Time" value="Not recorded" />
                          <DetailLine label="Approved By" value="Not approved" />
                          <DetailLine label="Approved Date & Time" value="Not recorded" />
                          <DetailLine label="Last Updated By" value={activityDetails.activity.employeeName || "System"} />
                          <DetailLine label="Last Updated Date & Time" value={formatDateTime(activityDetails.activity.entryTime)} />
                          <DetailLine label="Blockchain Status" value="Not stored" />
                          <DetailLine label="Transaction Hash" value="No linked blockchain hash" mono full />
                          <DetailLine label="Duplicate Warning" value="No linked duplicate warning" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <div className="premium-card rounded-[1.35rem] p-5">
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Audit History</h4>
                          <p className="mt-4 text-sm font-bold text-slate-500">No linked invoice audit history is attached to this activity.</p>
                        </div>
                        <div className="premium-card rounded-[1.35rem] p-5">
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Revision History</h4>
                          <p className="mt-4 text-sm font-bold text-slate-500">No linked invoice revisions are attached to this activity.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
              <button type="button" onClick={() => setActivityDetails(null)} className="ui-btn ui-btn-md ui-btn-secondary w-full sm:w-auto">
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
