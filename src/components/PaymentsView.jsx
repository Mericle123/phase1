import { useState } from "react";
import { Search, Clock, Download, X } from "lucide-react";
import { cn } from "../lib/utils";
import { downloadFormattedExcel, objectsToRows } from "../lib/exportCsv";
import { toast } from "sonner";
import { currencyCodeForRecord, formatCurrencyAmount, numericCurrencyAmount, supportedCurrencyLabels } from "../lib/currency";
import BOBLogo from "../assets/BOB.png";
import BDBLLogo from "../assets/BDBL.png";
import BNBLogo from "../assets/BNB.png";
import TBankLogo from "../assets/T-Bank.jpg";
import DigitalKiduLogo from "../assets/DIgital kidu.png";

const getEnteredByName = (record) =>
  record.enteredByName || record.submittedByName || record.employeeName || record.submittedBy?.name || "Unknown Employee";

const getEnteredByRole = (record) =>
  record.enteredByRole || record.submittedByRole || record.employeeRole || record.submittedBy?.roleLabel || "Employee";

const canSeeEntryOwner = (user) => ["admin", "super_admin"].includes(user?.role);

const numericAmount = numericCurrencyAmount;
const formatAmount = (value) => numericAmount(value).toLocaleString();
const getCurrencyCode = currencyCodeForRecord;
const formatMoney = (record, value) => formatCurrencyAmount(value, getCurrencyCode(record));

const getInvoiceAmount = (record) => record.invoiceAmount ?? record.amount;
const isPartiallyPaid = (status) => status === "Partially Paid" || status === "Pending";

export function PaymentsView({ clients, onViewInDirectory, user }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Open");
  const showEntryOwner = canSeeEntryOwner(user);
  
  const pendingPayments = clients
    .filter(c => c.paymentStatus === "Unpaid" || isPartiallyPaid(c.paymentStatus))
    .map(c => ({
      ...c,
      dueDate: "May 25, 2024",
      risk: numericAmount(getInvoiceAmount(c)) > 2000000 ? "High" : "Low"
    }))
    .sort((a, b) => numericAmount(getInvoiceAmount(b)) - numericAmount(getInvoiceAmount(a)));
  const paymentRows = clients
    .filter((client) => {
      if (statusFilter === "Open") return isPartiallyPaid(client.paymentStatus) || client.paymentStatus === "Unpaid";
      if (statusFilter === "Partially Paid") return isPartiallyPaid(client.paymentStatus);
      return client.paymentStatus === statusFilter;
    })
    .filter((client) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return [
        client.name,
        client.journalNo,
        client.paymentStatus,
        client.paymentReference,
        client.bank,
        showEntryOwner ? getEnteredByName(client) : "",
      ].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const rank = { "Partially Paid": 0, Pending: 0, Unpaid: 1 };
      return (rank[a.paymentStatus] ?? 9) - (rank[b.paymentStatus] ?? 9) || numericAmount(getInvoiceAmount(b)) - numericAmount(getInvoiceAmount(a));
    });
  const receivablesByCurrency = pendingPayments.reduce((totals, payment) => {
    const code = getCurrencyCode(payment);
    totals[code] = (totals[code] || 0) + numericAmount(getInvoiceAmount(payment)) - numericAmount(payment.amountReceived);
    return totals;
  }, {});

  const banks = [
    { name: "Bank of Bhutan", logo: BOBLogo },
    { name: "Bhutan Development Bank", logo: BDBLLogo },
    { name: "Bhutan National Bank", logo: BNBLogo },
    { name: "T-Bank", logo: TBankLogo },
    { name: "Digital Kidu", logo: DigitalKiduLogo },
  ];

  const getBankLogo = (bankName) => {
    return banks.find(b => b.name === bankName)?.logo || BOBLogo;
  };

  const handleExport = () => {
    try {
      const exportData = clients.map(c => ({
        "Client Name": c.name,
        "Entity Type": c.type,
        "Contract Amount": formatMoney(c, getInvoiceAmount(c)),
        "Amount Received": formatMoney(c, c.amountReceived),
        "Balance Due": formatMoney(c, numericAmount(getInvoiceAmount(c)) - numericAmount(c.amountReceived)),
        "Payment Status": c.paymentStatus,
        ...(showEntryOwner ? { "Entered By": getEnteredByName(c), "Entered Role": getEnteredByRole(c) } : {}),
        "Journal Ref": c.journalNo || "N/A",
        "Institution": c.bank || "N/A",
        "Category": c.category,
        "Location": c.location
      }));

      downloadFormattedExcel(`NZ_Britannia_Payment_Ledger_${new Date().toISOString().split('T')[0]}.xls`, objectsToRows(exportData), {
        title: "Payment Management Ledger",
        subtitle: "Formatted payment register with received amounts, balances due, ownership, and bank details.",
        sheetName: "Payment Ledger",
      });
      toast.success("Payment Ledger Exported", { description: "Formatted payment workbook generated." });
    } catch {
      toast.error("Export Failed", { description: "Could not generate payment ledger." });
    }
  };

  return (
    <div className="ct-page p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8 motion-page pb-20">
      <div className="ct-section-hero flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="ct-eyebrow">
            Receivables Control
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-black text-white tracking-tight">Payment Management</h1>
          <p className="text-white/64 mt-1 font-medium">Focus on unpaid and part-paid records that still need action.</p>
        </div>
        <button 
          onClick={handleExport}
          className="ui-btn ui-btn-md ct-hero-action w-full md:w-auto"
        >
          <Download size={18} />
          Export Ledger
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ["Partially Paid", "Part payments received", "bg-amber-50 text-amber-700 border-amber-100"],
          ["Unpaid", "No payment recorded", "bg-rose-50 text-rose-700 border-rose-100"],
          ["Open", "Partially paid and unpaid", "bg-emerald-50 text-emerald-700 border-emerald-100"],
        ].map(([status, detail, tone]) => {
          const count = status === "Open"
            ? clients.filter((client) => isPartiallyPaid(client.paymentStatus) || client.paymentStatus === "Unpaid").length
            : status === "Partially Paid"
              ? clients.filter((client) => isPartiallyPaid(client.paymentStatus)).length
              : clients.filter((client) => client.paymentStatus === status).length;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                "ct-payment-status-card rounded-lg border p-5 text-left transition-all",
                tone,
                statusFilter === status ? "ring-4 ring-blue-500/10" : "hover:bg-white",
              )}
            >
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{status}</p>
              <p className="mt-2 text-3xl font-black">{count}</p>
              <p className="mt-1 text-xs font-bold opacity-75">{detail}</p>
            </button>
          );
        })}
      </div>

      <div className="premium-card premium-card-hover rounded-[1.35rem] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Receivables Summary</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{pendingPayments.length} open receivable{pendingPayments.length === 1 ? "" : "s"}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">Outstanding balances grouped by invoice currency.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(receivablesByCurrency).map(([code, total]) => (
                <span key={code} className="rounded-lg border border-[var(--ct-line)] bg-white/75 px-3 py-1.5 text-xs font-black text-slate-700">
                  {supportedCurrencyLabels[code] || code} {formatAmount(total)}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[22rem]">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Partially Paid</p>
              <p className="mt-1 text-2xl font-black text-amber-900">{clients.filter((client) => isPartiallyPaid(client.paymentStatus)).length}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Unpaid</p>
              <p className="mt-1 text-2xl font-black text-rose-900">{clients.filter((client) => client.paymentStatus === "Unpaid").length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Open Receivables */}
        <div className="space-y-6">
          <div className="premium-card rounded-[1.6rem] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 shadow-inner">
                  <Clock size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Unpaid & Partially Paid Records</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Showing {statusFilter === "Open" ? "partially paid and unpaid" : statusFilter.toLowerCase()} records.</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner">
                {["Open", "Partially Paid", "Unpaid"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "rounded-xl px-3 py-2 text-xs font-black transition-all",
                      statusFilter === status ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="premium-input pl-10 pr-10 py-2.5 rounded-2xl text-sm outline-none w-full sm:w-64 transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear payment search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              </div>
            </div>
            
            <div className="ui-table-scroll custom-scrollbar">
              <table className="ui-table ledger-table">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="w-[30%]">Client / Reference</th>
                    <th className="w-[24%]">Financial Institution</th>
                    <th className="w-[16%]">Amount / Received</th>
                    <th className="w-[14%]">Status</th>
                    <th className="ui-action-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((payment, i) => (
                    <tr key={i} className="group">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="record-avatar w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-[10px] shadow-inner ring-1 ring-white/70">
                            {payment.initials}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{payment.name}</p>
                            <p className="text-[10px] font-mono text-slate-400">Ref: {payment.journalNo || "TRX-8821"}</p>
                            {isPartiallyPaid(payment.paymentStatus) && (
                              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-600">Part payment received</p>
                            )}
                            {showEntryOwner && (
                              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Entered by {getEnteredByName(payment)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center p-1 shadow-sm">
                            <img src={getBankLogo(payment.bank)} alt={payment.bank} className="max-h-full max-w-full object-contain" />
                          </div>
                          <span className="text-xs font-bold text-slate-600">{payment.bank || "Transfer"}</span>
                        </div>
                      </td>
                      <td className="font-black text-slate-900 text-sm">
                        <p>{formatMoney(payment, payment.amountReceived)}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">of {formatMoney(payment, getInvoiceAmount(payment))}</p>
                      </td>
                      <td>
                        <span className={cn(
                          "ui-status-badge",
                          payment.paymentStatus === "Paid" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                          isPartiallyPaid(payment.paymentStatus) && "bg-amber-50 text-amber-700 border-amber-100",
                          payment.paymentStatus === "Unpaid" && "bg-rose-50 text-rose-700 border-rose-100",
                        )}>
                          {isPartiallyPaid(payment.paymentStatus) ? "Partially Paid" : payment.paymentStatus}
                        </span>
                      </td>
                      <td className="ui-action-cell">
                        <button 
                          onClick={() => onViewInDirectory(payment)}
                          className="ui-btn ui-btn-sm ui-btn-secondary"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paymentRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-14 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-slate-500">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <Search size={20} />
                          </div>
                          <p className="font-bold text-slate-900">No records found</p>
                          <p className="text-sm">Try a different status or clear the search.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="ui-card-list">
              {paymentRows.map((payment, i) => (
                <article key={i} className="ui-mobile-record">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{payment.name}</p>
                      <p className="mt-1 font-mono text-[10px] font-bold text-slate-400">Ref: {payment.journalNo || "TRX-8821"}</p>
                      {showEntryOwner && (
                        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Entered by {getEnteredByName(payment)}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      "ui-status-badge",
                      payment.paymentStatus === "Paid" && "bg-emerald-50 text-emerald-600 border-emerald-100",
                      isPartiallyPaid(payment.paymentStatus) && "bg-amber-50 text-amber-700 border-amber-100",
                      payment.paymentStatus === "Unpaid" && "bg-rose-50 text-rose-700 border-rose-100",
                    )}>{isPartiallyPaid(payment.paymentStatus) ? "Partially Paid" : payment.paymentStatus}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-black uppercase tracking-widest text-slate-400">Bank</p>
                      <p className="mt-1 font-bold text-slate-700">{payment.bank || "Transfer"}</p>
                    </div>
                    <div>
                      <p className="font-black uppercase tracking-widest text-slate-400">Amount</p>
                      <p className="mt-1 font-black text-slate-900">{formatMoney(payment, payment.amountReceived)} / {formatMoney(payment, getInvoiceAmount(payment))}</p>
                    </div>
                  </div>
                  <button onClick={() => onViewInDirectory(payment)} className="ui-btn ui-btn-sm ui-btn-secondary mt-4 w-full">
                    View
                  </button>
                </article>
              ))}
              {paymentRows.length === 0 && (
                <div className="p-8 text-center text-sm font-bold text-slate-500">No records found.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
