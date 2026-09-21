import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileWarning,
  Filter,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { downloadFormattedExcel, objectsToRows } from "../lib/exportCsv";
import { api } from "../services/api";

const reviewOptions = ["All", "Pending Review", "Approved", "Rejected", "Verified", "Flagged"];
const officeOptions = ["All", "In Office", "Remote / Unverified", "Location Permission Enabled", "Unknown"];
const qualityOptions = ["All", "Needs Attention", "Normal", "Late Entry", "Outside Office Entry", "Duplicate Journal Attempt", "Edited After Payment Confirmation"];

const badgeClass = {
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Partially Paid": "bg-amber-50 text-amber-700 border-amber-100",
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  Unpaid: "bg-rose-50 text-rose-700 border-rose-100",
  "Pending Review": "bg-amber-50 text-amber-700 border-amber-100",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Rejected: "bg-rose-50 text-rose-700 border-rose-100",
  Verified: "bg-blue-50 text-blue-700 border-blue-100",
  Flagged: "bg-orange-50 text-orange-700 border-orange-100",
  "In Office": "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Remote / Unverified": "bg-amber-50 text-amber-700 border-amber-100",
  "Location Permission Enabled": "bg-blue-50 text-blue-700 border-blue-100",
  Unknown: "bg-slate-100 text-slate-600 border-slate-200",
  "Trusted Session": "bg-blue-50 text-blue-700 border-blue-100",
  "No Active Session": "bg-slate-100 text-slate-600 border-slate-200",
  "Device Changed": "bg-rose-50 text-rose-700 border-rose-100",
  "Session Mismatch": "bg-rose-50 text-rose-700 border-rose-100",
  Active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Inactive: "bg-slate-100 text-slate-600 border-slate-200",
  Clear: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Stored: "bg-blue-50 text-blue-700 border-blue-100",
  "Pending Commit": "bg-amber-50 text-amber-700 border-amber-100",
  "Not Stored": "bg-slate-100 text-slate-600 border-slate-200",
  Normal: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Late Entry": "bg-amber-50 text-amber-700 border-amber-100",
  "Outside Office Entry": "bg-orange-50 text-orange-700 border-orange-100",
  "Duplicate Journal Attempt": "bg-rose-50 text-rose-700 border-rose-100",
  "Unusual Update After Verification": "bg-indigo-50 text-indigo-700 border-indigo-100",
  "Inactive User Activity": "bg-slate-100 text-slate-600 border-slate-200",
  "Multiple Failed Attempts": "bg-rose-50 text-rose-700 border-rose-100",
  "Edited After Payment Confirmation": "bg-amber-50 text-amber-700 border-amber-100",
};

const StatusBadge = ({ value }) => (
  <span className={cn("ui-status-badge", badgeClass[value] || badgeClass.Unknown)}>
    {value === "Pending" ? "Partially Paid" : value || "Unknown"}
  </span>
);

const MetricCard = ({ title, value, icon: Icon, tone = "slate", subtext }) => {
  const tones = {
    slate: "bg-slate-950 text-white",
    blue: "bg-blue-700 text-white",
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-white",
    rose: "bg-rose-600 text-white",
  };
  return (
    <div className="premium-card premium-card-hover rounded-[1.35rem] p-5 transition-all duration-300 hover:-translate-y-1">
      <div className={cn("metric-icon flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg shadow-slate-200/60", tones[tone])}>
        <Icon size={20} />
      </div>
      <p className="mt-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
      {subtext && <p className="mt-1 text-xs font-medium text-slate-500">{subtext}</p>}
    </div>
  );
};

const SelectFilter = ({ label, value, options, onChange }) => (
  <label className="block">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="premium-input ui-select mt-2 w-full rounded-2xl px-3 py-2.5 text-xs font-black text-slate-900 outline-none"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </label>
);

const normalize = (value) => String(value || "").toLowerCase();

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "Not recorded");

const compactId = (value) => {
  if (!value) return "System";
  const text = String(value);
  return text.length > 10 ? text.slice(0, 8) : text;
};

const getRecordIssue = (record) => {
  if (record.duplicateJournalWarning && record.duplicateJournalWarning !== "Clear") return "Duplicate Journal Attempt";
  if (record.revisionCount > 0) return "Edited After Payment Confirmation";
  if (record.officePresenceStatus === "Remote / Unverified") return "Outside Office Entry";
  if (["Device Changed", "Session Mismatch"].includes(record.entryDeviceStatus)) return "Multiple Failed Attempts";
  if (record.activityStatus === "Inactive") return "Inactive User Activity";
  const hour = new Date(record.entryDateTime || record.createdAt || "").getHours();
  if (!Number.isNaN(hour) && (hour < 8 || hour >= 18)) return "Late Entry";
  if (record.adminReviewStatus === "Flagged") return "Unusual Update After Verification";
  return "Normal";
};

const getEmployeeName = (record) =>
  record.submittedByName || record.enteredByName || record.employeeName || record.submittedBy?.name || "Unknown Employee";

const getEmployeeRole = (record) =>
  record.submittedByRole || record.enteredByRole || record.employeeRole || record.submittedBy?.roleLabel || "Employee";

const getEmployeeDepartment = (record) =>
  record.submittedByDepartment || record.enteredByDepartment || record.employeeDepartment || "General";

const getEnteredByName = (record) =>
  record.enteredByName || record.submittedByName || record.employeeName || record.submittedBy?.name || "Unknown Employee";

const getEnteredByRole = (record) =>
  record.enteredByRole || record.submittedByRole || record.employeeRole || record.submittedBy?.roleLabel || "Employee";

export function AdminDashboard({ clients = [], onReviewRecord, onVerifyPayment, onViewDetails }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    payment: "All",
    review: "All",
    office: "All",
    quality: "All",
    date: "",
  });
  const [sort, setSort] = useState({ key: "entryDateTime", direction: "desc" });
  const [page, setPage] = useState(1);
  const [reviewModal, setReviewModal] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionSuccess, setRevisionSuccess] = useState(null);
  const [actionRecord, setActionRecord] = useState(null);
  const [employeeMessage, setEmployeeMessage] = useState("");
  const hasOpenModal = Boolean(actionRecord || reviewModal || revisionSuccess);

  useEffect(() => {
    if (!hasOpenModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasOpenModal]);

  const filteredRecords = useMemo(() => {
    const q = normalize(query);
    return clients
      .filter((client) => {
        if (filters.review !== "All" && client.adminReviewStatus !== filters.review) return false;
        if (filters.office !== "All" && client.officePresenceStatus !== filters.office) return false;
        const issue = getRecordIssue(client);
        if (filters.quality === "Needs Attention" && issue === "Normal") return false;
        if (!["All", "Needs Attention"].includes(filters.quality) && issue !== filters.quality) return false;
        if (filters.date && !String(client.entryDateTime || client.createdAt || "").startsWith(filters.date)) return false;
        if (!q) return true;
        return [
          client.clientName,
          client.journalNo,
          getEmployeeName(client),
          getEmployeeRole(client),
          client.verifiedByName,
          client.approvedByName,
          client.lastUpdatedByName,
          client.paymentStatus,
          client.adminReviewStatus,
          client.officePresenceStatus,
          client.entryDeviceStatus,
          client.entryActivityType,
          client.blockchain?.transactionId,
          client.auditNotes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const direction = sort.direction === "asc" ? 1 : -1;
        const av = sort.key === "submittedByName"
          ? getEmployeeName(a)
          : sort.key === "enteredByName"
            ? getEnteredByName(a)
            : a[sort.key] || "";
        const bv = sort.key === "submittedByName"
          ? getEmployeeName(b)
          : sort.key === "enteredByName"
            ? getEnteredByName(b)
            : b[sort.key] || "";
        if (sort.key === "entryDateTime") return (new Date(av).getTime() - new Date(bv).getTime()) * direction;
        return String(av).localeCompare(String(bv)) * direction;
      });
  }, [clients, filters, query, sort]);

  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const visibleRecords = filteredRecords.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const openReviewModal = (record, status) => {
    setReviewModal({
      record,
      status,
      isBlockchainRevision: Boolean(record.isBlockchainLocked || record.blockchain?.transactionId),
    });
    setRemarks(record.adminReviewRemarks || "");
    setRevisionReason("");
  };

  const submitReview = async () => {
    if (!reviewModal) return;
    if (reviewModal.isBlockchainRevision && !revisionReason.trim()) {
      toast.error("Revision reason required", { description: "Please explain why this locked blockchain record needs an update." });
      return;
    }
    try {
      await onReviewRecord(reviewModal.record.id, {
        reviewStatus: reviewModal.status,
        remarks: remarks || `${reviewModal.status} by admin.`,
        ...(reviewModal.isBlockchainRevision
          ? {
              confirmBlockchainRevision: true,
              revisionReason: revisionReason.trim(),
            }
          : {}),
      });
      if (reviewModal.isBlockchainRevision) {
        setRevisionSuccess({
          clientName: reviewModal.record.clientName,
          journalNo: reviewModal.record.journalNo,
        });
      } else {
        toast.success(`Record ${reviewModal.status.toLowerCase()}`, {
          description: `${reviewModal.record.journalNo} has been updated.`,
        });
      }
      setReviewModal(null);
      setRemarks("");
      setRevisionReason("");
    } catch (error) {
      toast.error("Review update failed", { description: error.message });
    }
  };

  const quickUpdatePaymentStatus = async (record, status) => {
    if (!onVerifyPayment) return;
    if (record.paymentStatus === status) return;
    const reference = record.paymentReference || `ADMIN-${record.journalNo || compactId(record.id)}`;
    const invoiceAmount = Number.parseFloat(String(record.invoiceAmount || record.amount || "0").replace(/,/g, "")) || 0;
    const currentReceived = Number.parseFloat(String(record.amountReceived || "0").replace(/,/g, "")) || 0;
    const amountReceived =
      status === "Paid"
        ? invoiceAmount
        : status === "Partially Paid"
          ? currentReceived > 0 && currentReceived < invoiceAmount
            ? currentReceived
            : Math.max(1, Math.floor(invoiceAmount / 2))
          : 0;
    try {
      const invoice = await onVerifyPayment(record.id, {
        paymentStatus: status,
        journalNo: record.journalNo,
        bank: record.bank || "",
        paymentSender: record.paymentSender || record.clientName,
        paymentMethod: record.paymentMethod || "Bank Transfer",
        paymentReference: reference,
        amountReceived,
        paymentDate: record.paymentDate || new Date().toISOString().slice(0, 10),
        verificationRemarks: record.verificationRemarks || "Verified by administrator after reviewing employee submission.",
      });
      toast.success(`Payment marked ${invoice.paymentStatus}`, {
        description: invoice.paymentStatus === "Paid" ? `${record.journalNo} was committed to the ledger layer.` : `${record.journalNo} status was updated.`,
      });
    } catch (error) {
      toast.error("Payment status update failed", { description: error.message });
    }
  };

  const sendEmployeeMessage = async (record) => {
    const message = employeeMessage.trim() || `Please review ${record.journalNo || record.clientName}. Entry quality status: ${getRecordIssue(record)}.`;
    try {
      await api.sendNotification({
        target: record.enteredBy,
        title: `Record correction: ${record.journalNo || record.clientName}`,
        message,
      });
      setEmployeeMessage("");
      toast.success("Message sent", { description: `${getEnteredByName(record)} will see it in notifications.` });
    } catch (error) {
      toast.error("Message failed", { description: error.message });
    }
  };

  const exportRecords = () => {
    const rows = filteredRecords.map((record) => ({
      "Employee Name": getEmployeeName(record),
      "Employee Role": getEmployeeRole(record),
      Department: getEmployeeDepartment(record),
      "Submitted Record": record.clientName,
      "Entry Time": record.entryDateTime ? new Date(record.entryDateTime).toLocaleString() : "",
      "Payment Status": record.paymentStatus,
      "Journal Number": record.journalNo,
      "Verification Status": record.adminReviewStatus,
      "Office Presence": record.officePresenceStatus,
      "Device/Session Status": record.entryDeviceStatus,
      "Activity Type": record.entryActivityType,
      "Activity Status": record.activityStatus,
      "Duplicate Warning": record.duplicateJournalWarning,
      "Blockchain Status": record.blockchainStorageStatus,
      "Audit Notes": record.auditNotes,
      "Entered By": getEnteredByName(record),
      "Verified By": record.verifiedByName,
      "Approved By": record.approvedByName || "",
      "Last Updated By": record.lastUpdatedByName,
    }));
    downloadFormattedExcel(`NZ_Britannia_Admin_Records_${new Date().toISOString().slice(0, 10)}.xls`, objectsToRows(rows), {
      title: "Admin Verification Records",
      subtitle: "Formatted admin review export with ownership, verification, activity, and blockchain status.",
      sheetName: "Admin Records",
    });
    toast.success("Admin records exported", { description: "Formatted admin workbook generated." });
  };

  const metrics = {
    total: clients.length,
    pendingReview: clients.filter((client) => client.adminReviewStatus === "Pending Review").length,
    flagged: clients.filter((client) => client.adminReviewStatus === "Flagged" || client.duplicateJournalWarning !== "Clear").length,
    office: clients.filter((client) => client.officePresenceStatus === "In Office").length,
    stored: clients.filter((client) => client.blockchainStorageStatus === "Stored").length,
  };

  return (
    <div className="ct-page ct-admin-dashboard p-4 sm:p-6 lg:p-8 max-w-[1700px] mx-auto space-y-8 motion-page pb-20">
      <div className="ct-section-hero ct-dashboard-hero flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <div className="ct-eyebrow">
            <ClipboardCheck size={14} />
            Admin Supervision
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-white">Admin Dashboard</h1>
          <p className="text-white/64 mt-2 max-w-3xl">
            Review employee-submitted records, monitor office presence, validate journals, and approve or flag invoices before audit closure.
          </p>
        </div>
        <button
          onClick={exportRecords}
          className="ui-btn ui-btn-md ct-hero-action"
        >
          <Download size={18} />
          Export Records
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
        <MetricCard title="Submitted Records" value={metrics.total} icon={ClipboardCheck} tone="slate" />
        <MetricCard title="Pending Review" value={metrics.pendingReview} icon={AlertTriangle} tone="amber" />
        <MetricCard title="Flagged / Duplicate" value={metrics.flagged} icon={FileWarning} tone="rose" />
        <MetricCard title="Office Entries" value={metrics.office} icon={ShieldCheck} tone="emerald" />
        <MetricCard title="Blockchain Stored" value={metrics.stored} icon={CheckCircle2} tone="blue" />
      </div>

      <div className="premium-card ct-dashboard-filter-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Filter size={18} className="text-blue-700" />
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Record Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <label className="block xl:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search</span>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Employee, journal, client, status..."
                className="premium-input w-full rounded-2xl py-2.5 pl-10 pr-10 text-sm outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
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
              onChange={(event) => updateFilter("date", event.target.value)}
              className="premium-input mt-2 w-full rounded-2xl px-3 py-2.5 text-xs font-black text-slate-900 outline-none"
            />
          </label>
          <SelectFilter label="Verification" value={filters.review} options={reviewOptions} onChange={(value) => updateFilter("review", value)} />
          <SelectFilter label="Office" value={filters.office} options={officeOptions} onChange={(value) => updateFilter("office", value)} />
          <SelectFilter label="Entry Quality" value={filters.quality} options={qualityOptions} onChange={(value) => updateFilter("quality", value)} />
        </div>
      </div>

      <div className="premium-card ct-dashboard-records-card rounded-[1.35rem] overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Employee Submitted Records</h2>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Showing {visibleRecords.length} of {filteredRecords.length} records
            </p>
          </div>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
            Admin review mode
          </span>
        </div>

        <div className="hidden xl:block ui-table-scroll custom-scrollbar">
          <table className="ui-table">
            <thead>
              <tr>
                {[
                  ["id", "Record ID"],
                  ["submittedByName", "Employee Name"],
                  ["enteredByName", "Entered By"],
                  ["verifiedByName", "Verified By"],
                  ["paymentStatus", "Payment"],
                  ["journalNo", "Journal"],
                  ["entryDateTime", "Entry Time"],
                  ["officePresenceStatus", "Office"],
                  ["riskStatus", "Risk / Unusual"],
                ].map(([key, label]) => (
                  <th key={key}>
                    <button
                      onClick={() => key !== "riskStatus" && toggleSort(key)}
                      className="no-motion inline-flex min-h-0 items-center gap-1 text-left hover:text-slate-900"
                    >
                      {label}
                      {key !== "riskStatus" && <ArrowDownUp size={12} />}
                    </button>
                  </th>
                ))}
                <th className="ui-action-cell">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {visibleRecords.map((record) => (
                <tr key={record.id} className="hover:bg-white/85 transition-all duration-200">
                  <td>
                    <p className="font-mono text-xs font-black text-slate-900">#{compactId(record.id)}</p>
                    <p className="mt-1 max-w-[13rem] truncate text-[10px] font-bold text-slate-400" title={record.clientName}>
                      {record.clientName}
                    </p>
                  </td>
                  <td>
                    <p className="font-black text-slate-900">{getEmployeeName(record)}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{getEmployeeDepartment(record)}</p>
                  </td>
                  <td>
                    <p className="text-xs font-bold text-slate-700">{getEnteredByName(record)}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{getEnteredByRole(record)}</p>
                  </td>
                  <td>
                    <p className="text-xs font-bold text-slate-700">{record.verifiedByName || "Not verified"}</p>
                    <p className="mt-1 text-[10px] font-mono font-bold text-slate-400">{formatDateTime(record.verifiedAt)}</p>
                  </td>
                  <td><StatusBadge value={record.paymentStatus} /></td>
                  <td className="font-mono text-xs font-black text-slate-700">{record.journalNo}</td>
                  <td className="font-mono text-[11px] text-slate-500">{formatDateTime(record.entryDateTime)}</td>
                  <td><StatusBadge value={record.officePresenceStatus} /></td>
                  <td>
                    <StatusBadge value={getRecordIssue(record)} />
                  </td>
                  <td className="ui-action-cell">
                    <div className="ui-table-actions">
                      <button onClick={() => onViewDetails(record)} className="ui-icon-btn" title="View full details" aria-label="View full details">
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => setActionRecord(record)}
                        className="ui-btn ui-btn-sm ui-btn-secondary"
                      >
                        Review
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleRecords.length && (
                <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 border border-blue-100">
                        <Search size={20} />
                      </div>
                      <p className="mt-3 font-black text-slate-900">No submitted records found</p>
                      <p className="mt-1 text-sm text-slate-500">Try clearing filters or changing the date range.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="xl:hidden divide-y divide-slate-100">
          {visibleRecords.map((record) => (
            <div key={record.id} className="p-4 sm:p-5 hover:bg-white/70 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-black uppercase tracking-widest text-slate-400">#{compactId(record.id)}</p>
                  <h3 className="mt-1 truncate text-base font-black text-slate-950">{record.clientName}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">Employee: {getEmployeeName(record)}</p>
                </div>
                <StatusBadge value={getRecordIssue(record)} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Entered By</p>
                  <p className="mt-1 font-bold text-slate-800">{getEnteredByName(record)}</p>
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Verified By</p>
                  <p className="mt-1 font-bold text-slate-800">{record.verifiedByName || "Not verified"}</p>
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Journal</p>
                  <p className="mt-1 font-mono font-bold text-slate-800">{record.journalNo}</p>
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Entry Time</p>
                  <p className="mt-1 font-mono font-bold text-slate-600">{formatDateTime(record.entryDateTime)}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusBadge value={record.paymentStatus} />
                <StatusBadge value={record.officePresenceStatus} />
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => onViewDetails(record)}
                  className="ui-btn ui-btn-sm ui-btn-soft flex-1"
                >
                  <Eye size={16} />
                  Details
                </button>
                <button
                  onClick={() => setActionRecord(record)}
                  className="ui-btn ui-btn-sm ui-btn-secondary flex-1"
                >
                  Review Actions
                </button>
              </div>
            </div>
          ))}
          {!visibleRecords.length && (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto max-w-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 border border-blue-100">
                  <Search size={20} />
                </div>
                <p className="mt-3 font-black text-slate-900">No submitted records found</p>
                <p className="mt-1 text-sm text-slate-500">Try clearing filters or changing the date range.</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-200/70 bg-white/45 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs font-medium text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="ui-btn ui-btn-sm ui-btn-secondary">
              Previous
            </button>
            <button disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="ui-btn ui-btn-sm ui-btn-secondary">
              Next
            </button>
          </div>
        </div>
      </div>

      {actionRecord && (
        <div className="ui-modal-backdrop">
          <div className="glass-panel ui-modal-panel max-w-lg motion-pop">
            <div className="ui-modal-header border-b border-slate-200/70 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Record Actions</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{actionRecord.clientName}</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  #{compactId(actionRecord.id)} / {actionRecord.journalNo}
                </p>
              </div>
              <button onClick={() => setActionRecord(null)} className="rounded-full bg-white p-2 text-slate-400 hover:text-slate-950">
                <XCircle size={20} />
              </button>
              </div>
            </div>
            <div className="ui-modal-body custom-scrollbar p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-3 text-xs">
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                <p className="font-black uppercase tracking-widest text-slate-400">Accountability</p>
                <p className="mt-2 font-bold text-slate-800">Entered by {getEnteredByName(actionRecord)}</p>
                <p className="mt-1 font-bold text-slate-600">Verified by {actionRecord.verifiedByName || "Not verified"}</p>
                <p className="mt-1 font-bold text-slate-600">Last updated by {actionRecord.lastUpdatedByName || "System"}</p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-blue-800">
                  <MessageSquare size={15} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Message Employee</p>
                </div>
                <textarea
                  value={employeeMessage}
                  onChange={(event) => setEmployeeMessage(event.target.value)}
                  rows={3}
                  placeholder={`Ask ${getEnteredByName(actionRecord)} to review this record...`}
                  className="premium-input w-full resize-none rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none"
                />
                <button type="button" onClick={() => sendEmployeeMessage(actionRecord)} className="ui-btn ui-btn-sm ui-btn-primary mt-3 w-full">
                  <Send size={14} />
                  Send Notification
                </button>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {["Approved", "Rejected", "Flagged", "Verified"].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    const record = actionRecord;
                    setActionRecord(null);
                    openReviewModal(record, status);
                  }}
                  className={cn(
                    "ui-btn ui-btn-sm",
                    status === "Approved" && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                    status === "Rejected" && "bg-rose-50 text-rose-700 hover:bg-rose-100",
                    status === "Flagged" && "bg-orange-50 text-orange-700 hover:bg-orange-100",
                    status === "Verified" && "bg-blue-50 text-blue-700 hover:bg-blue-100",
                  )}
                >
                  {status}
                </button>
              ))}
              {["Paid", "Partially Paid", "Unpaid"].map((status) => {
                const isCurrent = actionRecord.paymentStatus === status || (status === "Partially Paid" && actionRecord.paymentStatus === "Pending");
                return (
                  <button
                    key={status}
                    disabled={isCurrent}
                    onClick={() => {
                      const record = actionRecord;
                      setActionRecord(null);
                      quickUpdatePaymentStatus(record, status);
                    }}
                    className={cn(
                      "ui-btn ui-btn-sm",
                      status === "Paid" && "ui-btn-primary",
                      status === "Partially Paid" && "ui-btn-secondary",
                      status === "Unpaid" && "ui-btn-danger",
                    )}
                  >
                    {status === "Paid" ? "Mark Paid" : status === "Partially Paid" ? "Mark Partially Paid" : `Mark ${status}`}
                  </button>
                );
              })}
            </div>
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
            <button
              onClick={() => {
                const record = actionRecord;
                setActionRecord(null);
                onViewDetails(record);
              }}
              className="ui-btn ui-btn-md ui-btn-soft w-full"
            >
              <Eye size={16} />
              View Full Details
            </button>
            </div>
          </div>
        </div>
      )}

      {reviewModal && (
        <div className="ui-modal-backdrop">
          <div className="glass-panel ui-modal-panel max-w-lg motion-pop">
            <div className="ui-modal-header border-b border-slate-200/70 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-950">{reviewModal.status} Record</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {reviewModal.record.clientName} / {reviewModal.record.journalNo}
                </p>
              </div>
              <button onClick={() => setReviewModal(null)} className="rounded-full bg-white p-2 text-slate-400 hover:text-slate-950">
                <XCircle size={20} />
              </button>
              </div>
            </div>
            <div className="ui-modal-body custom-scrollbar p-5 sm:p-6">
            {reviewModal.isBlockchainRevision && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 text-amber-600" size={18} />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-amber-800">Verified Record Is Locked</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                        Are you sure you want to update this verified record? This record has already been confirmed and stored on the blockchain. Any update will be logged as a new revision and will not overwrite the original blockchain record.
                      </p>
                    </div>
                  </div>
                </div>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Revision Reason <span className="text-rose-500">*</span>
                  </span>
                  <textarea
                    value={revisionReason}
                    onChange={(event) => setRevisionReason(event.target.value)}
                    rows={3}
                    className="premium-input mt-2 w-full rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none resize-none"
                    placeholder="Explain why this locked blockchain record needs a revision..."
                  />
                </label>
              </div>
            )}
            <label className="mt-6 block">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit Remarks</span>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                rows={4}
                className="premium-input mt-2 w-full rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none resize-none"
                placeholder="Add admin review note..."
              />
            </label>
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setReviewModal(null)} className="ui-btn ui-btn-md ui-btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={submitReview} className="ui-btn ui-btn-md ui-btn-primary flex-1">
                {reviewModal.isBlockchainRevision ? "Submit Revision" : "Save Review"}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
      {revisionSuccess && (
        <div className="ui-modal-backdrop">
          <div className="glass-panel ui-modal-panel max-w-md motion-pop">
            <div className="ui-modal-body custom-scrollbar p-6 sm:p-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-inner">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-xl font-black text-slate-950">Revision Submitted</h3>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              This update has been submitted successfully. The original blockchain record remains unchanged, and the update has been stored as a new revision for audit tracking.
            </p>
            <p className="mt-4 rounded-2xl border border-slate-100 bg-white/70 px-4 py-3 text-xs font-bold text-slate-500">
              {revisionSuccess.clientName} {revisionSuccess.journalNo ? `/ ${revisionSuccess.journalNo}` : ""}
            </p>
            <button
              onClick={() => setRevisionSuccess(null)}
              className="ui-btn ui-btn-md ui-btn-primary mt-6 w-full"
            >
              Done
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
