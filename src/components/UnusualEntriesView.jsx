import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { cn } from "../lib/utils";
import { downloadFormattedExcel, objectsToRows } from "../lib/exportCsv";

const issueClass = {
  "Late Entry": "bg-amber-50 text-amber-700 border-amber-100",
  "Outside Office Entry": "bg-orange-50 text-orange-700 border-orange-100",
  "Duplicate Journal Attempt": "bg-rose-50 text-rose-700 border-rose-100",
  "Multiple Failed Attempts": "bg-rose-50 text-rose-700 border-rose-100",
  "Inactive User Activity": "bg-slate-100 text-slate-600 border-slate-200",
  "Edited After Payment Confirmation": "bg-amber-50 text-amber-700 border-amber-100",
  "Unusual Update After Verification": "bg-indigo-50 text-indigo-700 border-indigo-100",
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "Not recorded");

const StatusBadge = ({ value }) => (
  <span className={cn("ui-status-badge", issueClass[value] || "bg-slate-100 text-slate-600 border-slate-200")}>
    {value || "Unusual Activity"}
  </span>
);

const compactId = (value) => {
  if (!value) return "System";
  const text = String(value);
  return text.length > 14 ? `${text.slice(0, 11)}...` : text;
};

const getIssueType = (entry) => entry.issueType || (entry.unusualReason ? "Unusual Activity" : "Needs Review");

const DetailLine = ({ label, value, full = false }) => (
  <div className={cn("rounded-2xl border border-slate-100 bg-white/75 p-4", full && "sm:col-span-2")}>
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-900">{value || "Not recorded"}</p>
  </div>
);

export function UnusualEntriesView() {
  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState("");
  const [issueFilter, setIssueFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [messageEntry, setMessageEntry] = useState(null);
  const [message, setMessage] = useState("");

  const loadEntries = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const payload = await api.employeeActivitySummary({});
      setSummary(payload);
    } catch (error) {
      toast.error("Unusual entries unavailable", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadEntries(), 0);
    const interval = window.setInterval(() => loadEntries(false), 30000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, []);

  const entries = useMemo(() => summary?.unusualEntries || [], [summary]);
  const issueTypes = useMemo(() => ["All", ...new Set(entries.map(getIssueType))], [entries]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const issue = getIssueType(entry);
      if (issueFilter !== "All" && issue !== issueFilter) return false;
      if (!q) return true;
      return [
        entry.employeeName,
        entry.roleLabel,
        entry.department,
        entry.recordId,
        entry.actionPerformed,
        entry.activityType,
        entry.officeStatus,
        entry.deviceSessionStatus,
        issue,
        entry.unusualReason,
        entry.remarks,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [entries, issueFilter, query]);

  const groupedByEmployee = useMemo(() => {
    const grouped = new Map();
    for (const entry of entries) {
      const key = entry.employeeId || entry.employeeName || "unknown";
      const current = grouped.get(key) || {
        id: entry.employeeId,
        name: entry.employeeName || "Unknown Employee",
        role: entry.roleLabel || "Employee",
        count: 0,
        latest: "",
      };
      current.count += 1;
      if (!current.latest || new Date(entry.entryTime || 0) > new Date(current.latest || 0)) {
        current.latest = entry.entryTime || "";
      }
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }, [entries]);

  const openDetails = async (entry) => {
    setDetails({ entry, invoice: null, isLoading: Boolean(entry.recordId) });
    if (!entry.recordId) return;
    try {
      const { invoice } = await api.invoice(entry.recordId);
      setDetails({ entry, invoice, isLoading: false });
    } catch {
      setDetails({ entry, invoice: null, isLoading: false });
    }
  };

  const openMessage = (entry) => {
    setMessageEntry(entry);
    setMessage(
      `Please review record ${entry.recordId || entry.actionPerformed}. Issue detected: ${getIssueType(entry)}. ${entry.unusualReason || ""}`.trim(),
    );
  };

  const sendMessage = async () => {
    if (!messageEntry?.employeeId) {
      toast.error("Employee unavailable", { description: "This entry is missing the employee account reference." });
      return;
    }
    try {
      await api.sendNotification({
        target: messageEntry.employeeId,
        title: `Entry issue: ${getIssueType(messageEntry)}`,
        message,
      });
      toast.success("Message sent", { description: `${messageEntry.employeeName} will see it in notifications.` });
      setMessageEntry(null);
      setMessage("");
    } catch (error) {
      toast.error("Message failed", { description: error.message });
    }
  };

  const exportRows = () => {
    const rows = filteredEntries.map((entry) => ({
      "Employee Name": entry.employeeName,
      Role: entry.roleLabel,
      Department: entry.department,
      "Record ID": entry.recordId || "System",
      Issue: getIssueType(entry),
      Reason: entry.unusualReason,
      Action: entry.actionPerformed,
      "Entry Time": formatDateTime(entry.entryTime),
      "Office Status": entry.officeStatus,
      "Device/Session": entry.deviceSessionStatus,
    }));
    downloadFormattedExcel(`NZ_Britannia_Unusual_Entries_${new Date().toISOString().slice(0, 10)}.xls`, objectsToRows(rows), {
      title: "Unusual Entry Detection",
      subtitle: "Formatted exception report with employee, issue reason, activity, office status, and session context.",
      sheetName: "Unusual Entries",
    });
    toast.success("Unusual entries exported", { description: "Formatted unusual-entry workbook generated." });
  };

  return (
    <div className="ct-page p-4 sm:p-6 lg:p-8 max-w-[1700px] mx-auto space-y-8 motion-page pb-20">
      <div className="ct-section-hero flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <div className="ct-eyebrow">
            <AlertTriangle size={14} />
            Entry Quality
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-white">Unusual Entries</h1>
          <p className="text-white/64 mt-2 max-w-3xl">
            Review late, duplicate, outside-office, and corrected-after-payment entries in one clear table.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={() => loadEntries()} className="ui-btn ui-btn-md ct-hero-secondary">
            <RefreshCw size={17} />
            Refresh
          </button>
          <button type="button" onClick={exportRows} className="ui-btn ui-btn-md ct-hero-action">
            <Download size={18} />
            Export Table
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="premium-card rounded-[1.35rem] p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Unusual Entries</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{entries.length}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Auto-detected by entry rules</p>
        </div>
        <div className="premium-card rounded-[1.35rem] p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employees With Issues</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{groupedByEmployee.length}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Grouped by account owner</p>
        </div>
        <div className="premium-card rounded-[1.35rem] p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visible In Table</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{filteredEntries.length}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{isLoading ? "Loading live data..." : "Search and filters applied"}</p>
        </div>
      </div>

      <div className="premium-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search unusual entries</span>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search employee, journal, issue, reason, office status..."
                className="premium-input w-full rounded-2xl py-3 pl-10 pr-10 text-sm outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-950"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </label>
          <div className="issue-filter-tabs flex max-w-full gap-2 overflow-x-auto pb-1">
            {issueTypes.map((issue) => (
              <button
                key={issue}
                type="button"
                onClick={() => setIssueFilter(issue)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition",
                  issueFilter === issue
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-950",
                )}
              >
                {issue}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="premium-card rounded-[1.35rem] overflow-hidden">
        <div className="border-b border-slate-200/70 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Unusual Entry Table</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                This is the dedicated table for sloppy, unusual, duplicate, late, and correction-needed entries.
              </p>
            </div>
            <span className="w-fit rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
              Live refresh 30s
            </span>
          </div>
        </div>

        <div className="ui-table-scroll custom-scrollbar">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Record / Invoice</th>
                <th>Issue</th>
                <th>Reason</th>
                <th>Entry Time</th>
                <th>Office / Device</th>
                <th className="ui-action-cell">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-amber-50/30">
                  <td>
                    <p className="font-black text-slate-900">{entry.employeeName || "Unknown Employee"}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {entry.roleLabel || "Employee"} / {entry.department || "General"}
                    </p>
                  </td>
                  <td>
                    <p className="font-mono text-xs font-black text-slate-800" title={entry.recordId || "System"}>
                      {compactId(entry.recordId)}
                    </p>
                    <p className="mt-1 max-w-[16rem] truncate text-[10px] font-bold text-slate-400" title={entry.actionPerformed}>
                      {entry.actionPerformed || entry.activityType || "Activity recorded"}
                    </p>
                  </td>
                  <td>
                    <StatusBadge value={getIssueType(entry)} />
                  </td>
                  <td>
                    <p className="max-w-[22rem] text-xs font-semibold leading-5 text-slate-600">
                      {entry.unusualReason || "Marked for review by the activity monitor."}
                    </p>
                  </td>
                  <td className="font-mono text-[11px] font-bold text-slate-500">{formatDateTime(entry.entryTime)}</td>
                  <td>
                    <p className="text-xs font-black text-slate-800">{entry.officeStatus || "Unknown"}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {entry.deviceSessionStatus || "No device signal"}
                    </p>
                  </td>
                  <td className="ui-action-cell">
                    <div className="ui-table-actions">
                      <button type="button" onClick={() => openDetails(entry)} className="ui-icon-btn" title="View details" aria-label="View details">
                        <Eye size={14} />
                      </button>
                      <button type="button" onClick={() => openMessage(entry)} className="ui-btn ui-btn-sm ui-btn-primary">
                        <MessageSquare size={14} />
                        Message
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredEntries.length && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <CheckCircle2 size={20} />
                      </div>
                      <p className="mt-3 font-black text-slate-900">{isLoading ? "Loading unusual entries..." : "No unusual entries found"}</p>
                      <p className="mt-1 text-sm text-slate-500">Try another search, or no issues have been detected yet.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ui-card-list">
          {filteredEntries.map((entry) => (
            <article key={entry.id} className="ui-mobile-record">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black text-slate-950">{entry.employeeName || "Unknown Employee"}</h3>
                  <p className="mt-1 font-mono text-[10px] font-bold text-slate-400">{compactId(entry.recordId)}</p>
                </div>
                <StatusBadge value={getIssueType(entry)} />
              </div>
              <p className="mt-3 text-sm font-semibold leading-5 text-slate-600">{entry.unusualReason || "Marked for review."}</p>
              <p className="mt-3 font-mono text-[10px] font-bold text-slate-500">{formatDateTime(entry.entryTime)}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => openDetails(entry)} className="ui-btn ui-btn-sm ui-btn-soft flex-1">
                  <Eye size={14} />
                  Details
                </button>
                <button type="button" onClick={() => openMessage(entry)} className="ui-btn ui-btn-sm ui-btn-primary flex-1">
                  <MessageSquare size={14} />
                  Message
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {messageEntry && (
        <div className="ui-modal-backdrop" role="presentation" onClick={() => setMessageEntry(null)}>
          <div
            className="glass-panel ui-modal-panel max-w-lg motion-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unusual-message-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ui-modal-header border-b border-slate-200/70 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Message Employee</p>
                  <h3 id="unusual-message-title" className="mt-2 text-xl font-black text-slate-950">{messageEntry.employeeName}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">{getIssueType(messageEntry)} / {compactId(messageEntry.recordId)}</p>
                </div>
                <button type="button" onClick={() => setMessageEntry(null)} className="ui-icon-btn" aria-label="Close message composer">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="ui-modal-body custom-scrollbar p-5 sm:p-6">
              <textarea
                rows={6}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="premium-input w-full resize-none rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none"
                placeholder="Write what the employee needs to correct..."
              />
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => setMessageEntry(null)} className="ui-btn ui-btn-md ui-btn-secondary flex-1">
                  Cancel
                </button>
                <button type="button" onClick={sendMessage} className="ui-btn ui-btn-md ui-btn-primary flex-1">
                  <Send size={17} />
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {details && (
        <div className="ui-modal-backdrop" role="presentation" onClick={() => setDetails(null)}>
          <div
            className="glass-panel ui-modal-panel max-w-4xl motion-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unusual-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ui-modal-header border-b border-slate-200/70 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Unusual Entry Details</p>
                  <h3 id="unusual-details-title" className="mt-2 text-xl font-black text-slate-950">
                    {details.invoice?.clientName || details.entry.actionPerformed || "Activity record"}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {details.isLoading ? "Loading linked invoice..." : `${getIssueType(details.entry)} / ${formatDateTime(details.entry.entryTime)}`}
                  </p>
                </div>
                <button type="button" onClick={() => setDetails(null)} className="ui-icon-btn" aria-label="Close details">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="ui-modal-body custom-scrollbar p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailLine label="Employee" value={details.entry.employeeName} />
                <DetailLine label="Role / Department" value={`${details.entry.roleLabel || ""} / ${details.entry.department || ""}`} />
                <DetailLine label="Record ID" value={details.entry.recordId || "System"} />
                <DetailLine label="Issue" value={getIssueType(details.entry)} />
                <DetailLine label="Entry Time" value={formatDateTime(details.entry.entryTime)} />
                <DetailLine label="Office / Device" value={`${details.entry.officeStatus || "Unknown"} / ${details.entry.deviceSessionStatus || "No device signal"}`} />
                <DetailLine label="Reason" value={details.entry.unusualReason} full />
                <DetailLine label="Action" value={details.entry.actionPerformed} full />
                {details.invoice && (
                  <>
                    <DetailLine label="Client" value={details.invoice.clientName} />
                    <DetailLine label="Journal" value={details.invoice.journalNo} />
                    <DetailLine label="Payment Status" value={details.invoice.paymentStatus} />
                    <DetailLine label="Entered By" value={details.invoice.enteredByName || details.invoice.submittedByName} />
                  </>
                )}
              </div>
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
              <button type="button" onClick={() => setDetails(null)} className="ui-btn ui-btn-md ui-btn-secondary w-full sm:w-auto">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
