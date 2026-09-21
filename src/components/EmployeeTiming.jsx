import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Download, IndianRupee, Search, ShieldCheck, TimerReset, Users, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { cn } from "../lib/utils";
import { downloadFormattedExcel, objectsToRows } from "../lib/exportCsv";
import { TaskLoader } from "./TaskLoader";

const today = () => new Date().toISOString().slice(0, 10);

const formatDateTime = (value) => (value ? new Date(value).toLocaleString([], {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}) : "Not checked in");

const money = (value) => `Nu. ${Number(value || 0).toLocaleString()}`;

const statusTone = {
  Early: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "On Time": "bg-emerald-50 text-emerald-700 border-emerald-100",
  Late: "bg-rose-50 text-rose-700 border-rose-100",
  Excused: "bg-blue-50 text-blue-700 border-blue-100",
  "Not Checked In": "bg-amber-50 text-amber-700 border-amber-100",
};

const exceptionTypes = ["Leave", "Emergency", "Medical", "Official Duty", "Remote Approved", "Other"];

const StatusBadge = ({ value }) => (
  <span className={cn("ui-status-badge", statusTone[value] || "bg-slate-100 text-slate-600 border-slate-200")}>
    {value}
  </span>
);

const TimingMetric = ({ title, value, detail, icon: Icon, tone = "green" }) => {
  const tones = {
    green: "bg-emerald-700 text-white",
    amber: "bg-amber-500 text-white",
    rose: "bg-rose-600 text-white",
    slate: "bg-[var(--ct-green-950)] text-white",
  };
  return (
    <div className="ct-stat-card premium-card premium-card-hover p-5">
      <div className={cn("ct-stat-icon flex h-11 w-11 items-center justify-center rounded-lg", tones[tone])}>
        <Icon size={20} />
      </div>
      <p className="mt-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  );
};

export function EmployeeTiming() {
  const [date, setDate] = useState(today());
  const [report, setReport] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [exceptionModal, setExceptionModal] = useState(null);
  const [exceptionForm, setExceptionForm] = useState({ type: "Emergency", reason: "" });
  const [isSavingException, setIsSavingException] = useState(false);
  const notifiedReports = useRef(new Set());

  useEffect(() => {
    let mounted = true;
    api
      .employeeTiming({ date })
      .then((payload) => {
        if (!mounted) return;
        setReport(payload);
        const metrics = payload.metrics || {};
        const notificationKey = `${payload.date}-${metrics.late || 0}-${metrics.totalDeduction || 0}`;
        if ((metrics.late || 0) > 0 && !notifiedReports.current.has(notificationKey)) {
          notifiedReports.current.add(notificationKey);
          toast.warning("Late penalties detected", {
            description: `${metrics.late} staff member${metrics.late === 1 ? "" : "s"} with ${money(metrics.totalDeduction)} total deduction.`,
          });
        }
      })
      .catch((error) => {
        if (mounted) toast.error("Timing report unavailable", { description: error.message });
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [date]);

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (report?.rows || []).filter((row) => {
      if (statusFilter !== "All" && row.status !== statusFilter) return false;
      if (!search) return true;
      return [row.name, row.roleLabel, row.department, row.status, row.note, row.exception?.type, row.exception?.reason].join(" ").toLowerCase().includes(search);
    });
  }, [query, report, statusFilter]);

  const openExceptionModal = (row) => {
    setExceptionModal(row);
    setExceptionForm({
      type: row.exception?.type || (row.status === "Not Checked In" ? "Leave" : "Emergency"),
      reason: row.exception?.reason || "",
    });
  };

  const saveException = async () => {
    if (!exceptionModal) return;
    if (exceptionForm.reason.trim().length < 4) {
      toast.error("Reason required", { description: "Add a short note explaining the leave or emergency." });
      return;
    }
    setIsSavingException(true);
    try {
      const payload = await api.saveTimingException({
        userId: exceptionModal.userId,
        date,
        type: exceptionForm.type,
        reason: exceptionForm.reason,
      });
      setReport(payload.report);
      setExceptionModal(null);
      toast.success("Deduction waived", {
        description: `${exceptionModal.name} is marked as ${exceptionForm.type}.`,
      });
    } catch (error) {
      toast.error("Exception not saved", { description: error.message });
    } finally {
      setIsSavingException(false);
    }
  };

  const removeException = async () => {
    if (!exceptionModal?.exception) return;
    setIsSavingException(true);
    try {
      const payload = await api.removeTimingException({
        userId: exceptionModal.userId,
        date,
      });
      setReport(payload.report);
      setExceptionModal(null);
      toast.success("Exception removed", {
        description: `${exceptionModal.name}'s deduction will be calculated normally again.`,
      });
    } catch (error) {
      toast.error("Exception not removed", { description: error.message });
    } finally {
      setIsSavingException(false);
    }
  };

  const exportTiming = () => {
    const exportRows = rows.map((row) => ({
      Employee: row.name,
      Role: row.roleLabel,
      Department: row.department,
      "Check In": formatDateTime(row.checkInAt),
      Status: row.status,
      "Late Minutes": row.lateMinutes,
      "Original Deduction": money(row.originalDeduction),
      "Payable Deduction": money(row.deduction),
      "Exception": row.exception ? `${row.exception.type}: ${row.exception.reason}` : "",
      "Office Status": row.officeStatus,
      "Activity Count": row.activityCount,
      Note: row.note,
    }));
    downloadFormattedExcel(`NZ_Britannia_Employee_Timing_${date}.xls`, objectsToRows(exportRows), {
      title: "Employee Timing and Late Penalty",
      subtitle: `Attendance register for ${date} with arrival, minutes late, and Nu. deduction amount.`,
      sheetName: "Employee Timing",
    });
    toast.success("Employee timing exported", { description: "Formatted timing workbook generated." });
  };

  return (
    <div className="ct-page p-4 sm:p-6 lg:p-8 max-w-[1700px] mx-auto space-y-8 motion-page pb-20">
      <section className="ct-section-hero flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="ct-eyebrow">
            <Clock3 size={14} />
            Attendance Control
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Employee Timing</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/64">
            Tracks first daily login/activity and calculates late deductions after the 09:30 grace window.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={16} />
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setIsLoading(true);
                setDate(event.target.value);
              }}
              className="h-11 w-full rounded-lg border border-white/15 bg-white/10 pl-10 pr-3 text-sm font-black text-white outline-none backdrop-blur placeholder:text-white/40 sm:w-auto"
            />
          </label>
          <button type="button" onClick={exportTiming} className="ui-btn ui-btn-md ct-hero-action w-full sm:w-auto">
            <Download size={17} />
            Export
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-6">
        <TimingMetric title="Staff Tracked" value={report?.metrics?.staff || 0} detail="Active non-owner users" icon={Users} tone="slate" />
        <TimingMetric title="On Time" value={report?.metrics?.onTime || 0} detail="Within 09:00-09:30" icon={ShieldCheck} tone="green" />
        <TimingMetric title="Late" value={report?.metrics?.late || 0} detail="Deduction applies" icon={AlertTriangle} tone="rose" />
        <TimingMetric title="Excused" value={report?.metrics?.excused || 0} detail={`${money(report?.metrics?.waivedDeduction)} waived`} icon={CheckCircle2} tone="green" />
        <TimingMetric title="Not Checked In" value={report?.metrics?.notCheckedIn || 0} detail="No activity yet" icon={TimerReset} tone="amber" />
        <TimingMetric title="Total Deduction" value={money(report?.metrics?.totalDeduction)} detail="For selected date" icon={IndianRupee} tone="rose" />
      </div>

      <section className="premium-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Timing Policy</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">09:00 to 09:30 approved arrival window</h2>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              One minute late after 09:30 cuts Nu. 501. The amount increases each minute. At 30 minutes late it becomes Nu. 1,000, and at 31 minutes it becomes Nu. 1,001.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs font-black sm:grid-cols-3 lg:min-w-[32rem]">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">09:00-09:30<br /><span className="text-lg">Nu. 0</span></div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-amber-700">09:31<br /><span className="text-lg">Nu. 501</span></div>
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-rose-700">10:00+<br /><span className="text-lg">Nu. 1,000+</span></div>
          </div>
        </div>
      </section>

      <section className="premium-card rounded-[1.35rem] overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[var(--ct-line)] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Daily Timing Register</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">{isLoading ? "Loading timing records..." : `${rows.length} staff records shown`}</p>
            {isLoading && <div className="mt-3"><TaskLoader type="timing" compact /></div>}
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <div className="timing-status-tabs flex max-w-full overflow-x-auto rounded-lg border border-[var(--ct-line)] bg-slate-100/80 p-1 custom-scrollbar">
              {["All", "On Time", "Late", "Excused", "Not Checked In"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-2 text-xs font-black transition-all",
                    statusFilter === status ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search staff..."
                className="premium-input h-11 w-full rounded-lg pl-10 pr-3 text-sm font-bold outline-none sm:w-64"
              />
            </div>
          </div>
        </div>

        <div className="ui-table-scroll custom-scrollbar">
          <table className="ui-table ledger-table employee-timing-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Check In</th>
                <th>Status</th>
                <th>Late Minutes</th>
                <th>Deduction</th>
                <th>Exception</th>
                <th>Office</th>
                <th>First Action</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId}>
                  <td>
                    <div className="flex min-w-[15rem] items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-lg border border-white bg-slate-100 shadow-sm">
                        <img src={row.avatar} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">{row.name}</p>
                        <p className="mt-1 max-w-[14rem] truncate text-[10px] font-black uppercase text-slate-400">{row.roleLabel} / {row.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs font-bold text-slate-600">{formatDateTime(row.checkInAt)}</td>
                  <td><StatusBadge value={row.status} /></td>
                  <td className="font-black text-slate-900">{row.lateMinutes || 0}</td>
                  <td className={cn("font-black", row.deduction > 0 ? "text-rose-600" : "text-emerald-700")}>
                    {money(row.deduction)}
                    {row.deductionWaived && (
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        {money(row.originalDeduction)} waived
                      </p>
                    )}
                  </td>
                  <td>
                    {row.exception ? (
                      <div className="max-w-[15rem]">
                        <p className="text-xs font-black text-blue-700">{row.exception.type}</p>
                        <p className="mt-1 truncate text-[10px] font-bold text-slate-500" title={row.exception.reason}>{row.exception.reason}</p>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">None</span>
                    )}
                  </td>
                  <td><StatusBadge value={row.officeStatus} /></td>
                  <td>
                    <p className="max-w-[16rem] truncate text-sm font-bold text-slate-800" title={row.firstAction || row.note}>{row.firstAction || row.note}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{row.activityCount} actions</p>
                  </td>
                  <td>
                    <button type="button" onClick={() => openExceptionModal(row)} className="ui-btn ui-btn-sm ui-btn-secondary whitespace-nowrap">
                      {row.exception ? "Edit Exception" : "Add Exception"}
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-sm font-bold text-slate-500">
                    No timing records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ui-card-list divide-y divide-[var(--ct-line)]">
          {rows.map((row) => (
            <article key={row.userId} className="ui-mobile-record">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white bg-slate-100 shadow-sm">
                    <img src={row.avatar} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-black text-slate-950">{row.name}</h3>
                    <p className="mt-1 truncate text-[10px] font-black uppercase text-slate-400">{row.roleLabel} / {row.department}</p>
                  </div>
                </div>
                <StatusBadge value={row.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Check In</p>
                  <p className="mt-1 font-mono font-bold text-slate-700">{formatDateTime(row.checkInAt)}</p>
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Late Minutes</p>
                  <p className="mt-1 font-black text-slate-900">{row.lateMinutes || 0}</p>
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Deduction</p>
                  <p className={cn("mt-1 font-black", row.deduction > 0 ? "text-rose-600" : "text-emerald-700")}>{money(row.deduction)}</p>
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Office</p>
                  <div className="mt-1"><StatusBadge value={row.officeStatus} /></div>
                </div>
              </div>

              {row.deductionWaived && (
                <p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                  {money(row.originalDeduction)} waived by approved exception.
                </p>
              )}

              <div className="mt-4 rounded-lg border border-[var(--ct-line)] bg-white/65 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">First Action</p>
                <p className="mt-1 text-xs font-bold leading-5 text-slate-700">{row.firstAction || row.note}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{row.activityCount} actions</p>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {row.exception && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                    <p className="text-xs font-black text-blue-700">{row.exception.type}</p>
                    <p className="mt-1 text-[11px] font-bold leading-4 text-slate-500">{row.exception.reason}</p>
                  </div>
                )}
                <button type="button" onClick={() => openExceptionModal(row)} className="ui-btn ui-btn-sm ui-btn-secondary w-full">
                  {row.exception ? "Edit Exception" : "Add Exception"}
                </button>
              </div>
            </article>
          ))}
          {!rows.length && (
            <div className="px-6 py-16 text-center text-sm font-bold text-slate-500">
              No timing records match the selected filters.
            </div>
          )}
        </div>
      </section>

      {exceptionModal && createPortal((
        <div className="ui-modal-backdrop" role="presentation" onClick={() => !isSavingException && setExceptionModal(null)}>
          <div
            className="glass-panel ui-modal-panel timing-exception-modal max-w-lg motion-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="timing-exception-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ui-modal-header border-b border-slate-200/70 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Pay Deduction Exception</p>
                  <h3 id="timing-exception-title" className="mt-2 text-xl font-black text-slate-950">{exceptionModal.name}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {date} / Original deduction {money(exceptionModal.originalDeduction)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExceptionModal(null)}
                  disabled={isSavingException}
                  className="ui-icon-btn"
                  aria-label="Close exception form"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="ui-modal-body custom-scrollbar space-y-5 p-5 sm:p-6">
              <div className="rounded-lg border border-[var(--ct-line)] bg-white/70 p-4">
                <p className="text-xs font-black text-slate-900">What this does</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Approving leave or emergency keeps the arrival record visible, but changes the payable deduction to Nu. 0 for this date.
                </p>
              </div>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exception Type</span>
                <select
                  value={exceptionForm.type}
                  onChange={(event) => setExceptionForm((current) => ({ ...current, type: event.target.value }))}
                  className="premium-input ui-select mt-2 w-full rounded-lg px-4 py-3 text-sm font-bold outline-none"
                >
                  {exceptionTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason / Note</span>
                <textarea
                  value={exceptionForm.reason}
                  onChange={(event) => setExceptionForm((current) => ({ ...current, reason: event.target.value }))}
                  rows={4}
                  placeholder="Example: Medical emergency reported before office hours."
                  className="premium-input mt-2 w-full resize-none rounded-lg px-4 py-3 text-sm font-bold outline-none"
                />
              </label>
              {exceptionModal.exception && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-xs font-bold text-blue-700">
                  Existing exception approved by {exceptionModal.exception.approvedByName} on {formatDateTime(exceptionModal.exception.approvedAt)}.
                </div>
              )}
            </div>
            <div className="ui-modal-footer flex flex-col gap-3 border-t border-slate-200/70 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              {exceptionModal.exception ? (
                <button
                  type="button"
                  onClick={removeException}
                  disabled={isSavingException}
                  className="ui-btn ui-btn-md ui-btn-danger"
                >
                  Remove Exception
                </button>
              ) : (
                <p className="hidden text-xs font-bold text-slate-500 sm:block">
                  Approval notifies the employee and keeps the timing record traceable.
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => setExceptionModal(null)} disabled={isSavingException} className="ui-btn ui-btn-md ui-btn-secondary">
                  Cancel
                </button>
                <button type="button" onClick={saveException} disabled={isSavingException} className="ui-btn ui-btn-md ui-btn-primary">
                  {isSavingException ? <TaskLoader type="timing" compact className="button-inline-loader" /> : "Approve Exception"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
