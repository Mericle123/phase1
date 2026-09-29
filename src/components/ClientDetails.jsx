import { ArrowLeft, ArrowRight, Building2, User, MapPin, ShieldCheck, PieChart, TrendingUp, Landmark, CreditCard, Database, History } from "lucide-react";
import { cn } from "../lib/utils";
import { currencyCodeForRecord, formatCurrencyAmount } from "../lib/currency";
import NZBritanniaMark from "../assets/nz-britannia-mark.png";


const DetailCard = ({ icon: Icon, title, children, className }) => (
  <div className={cn("premium-card premium-card-hover p-6 rounded-[1.35rem]", className)}>
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-700 border border-emerald-100 shadow-inner">
        <Icon size={20} />
      </div>
      <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {children}
    </div>
  </div>
);

const DetailField = ({ label, value, fullWidth }) => (
  <div className={cn("flex flex-col gap-1.5", fullWidth && "md:col-span-2")}>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
    <span className="text-sm font-bold text-slate-900 bg-white/70 border border-slate-100 px-4 py-3 rounded-2xl w-full min-h-[48px] flex items-center shadow-sm">
      {value || "Not Provided"}
    </span>
  </div>
);

const money = (client, value) => formatCurrencyAmount(value, currencyCodeForRecord(client));
const paymentStatusLabel = (status) => (status === "Pending" ? "Partially Paid" : status || "Unknown");
const paymentStatusTone = (status) =>
  paymentStatusLabel(status) === "Paid"
    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
    : paymentStatusLabel(status) === "Partially Paid"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : "bg-rose-50 text-rose-700 border-rose-100";

const InvoicePreview = ({ client }) => {
  const received = Number(client.amountReceived || 0);
  const total = Number(client.invoiceAmount || String(client.amount || "0").replace(/,/g, ""));
  const balance = Math.max(0, total - received);
  const previewRows = [
    ["Invoice Amount", total],
    ["Capital Cost", client.financialData?.capitalCost],
    ["Working Capital", client.financialData?.workingCapital],
  ].filter(([, value]) => Number(value || 0) > 0);

  return (
    <div className="premium-card rounded-[1.35rem] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preview</p>
          <h3 className="mt-1 text-sm font-black text-slate-950">Invoice Layout</h3>
        </div>
        <span className={cn(
          "ui-status-badge",
          paymentStatusTone(client.paymentStatus),
        )}>
          {paymentStatusLabel(client.paymentStatus)}
        </span>
      </div>
      <div className="rounded-[1.35rem] bg-[var(--ct-deep-forest)] p-4">
        <div className="generated-invoice-preview mx-auto max-w-[23rem] rounded-xl p-5 shadow-xl shadow-slate-300/40">
          <div className="flex items-start justify-between gap-3">
            <div className="ct-preview-logo flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-950 text-white">
              {client.companyLogo ? (
                <img src={client.companyLogo} alt={`${client.name} logo`} className="h-full w-full object-contain bg-white p-1" />
              ) : (
                <img src={NZBritanniaMark} alt="NZ Britannia mark" className="h-full w-full object-contain p-1.5" />
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice</p>
              <p className="mt-1 font-mono text-xs font-black text-slate-900">{client.journalNo || "Draft"}</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-[10px]">
            <div>
              <p className="font-black uppercase tracking-widest text-slate-400">Issue Date</p>
              <p className="mt-1 font-bold text-slate-800">{client.invoiceDate || "-"}</p>
            </div>
            <div>
              <p className="font-black uppercase tracking-widest text-slate-400">Currency</p>
              <p className="mt-1 font-bold text-slate-800">{client.currency || "BTN"}</p>
            </div>
            <div>
              <p className="font-black uppercase tracking-widest text-slate-400">Status</p>
              <p className="mt-1 font-bold text-slate-800">{client.paymentStatus}</p>
            </div>
          </div>
          <div className="mt-6 space-y-4 text-xs">
            <div>
              <p className="font-black uppercase tracking-widest text-slate-400">Billed To</p>
              <p className="mt-1 font-black text-slate-950">{client.name}</p>
              <p className="mt-1 text-slate-500">{client.organizationName || client.location}</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <div className="grid grid-cols-[1fr_auto] bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Item</span>
                <span>Amount</span>
              </div>
              {previewRows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[1fr_auto] border-t border-slate-100 px-3 py-2">
                  <span className="font-bold text-slate-700">{label}</span>
                  <span className="font-mono font-black text-slate-900">{money(client, value)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
              <div className="flex justify-between">
                <span className="font-bold text-slate-500">Received</span>
                <span className="font-mono font-black text-slate-900">{money(client, received)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-500">Balance</span>
                <span className="font-mono font-black text-slate-900">{money(client, balance)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="font-black text-slate-900">Total</span>
                <span className="font-mono font-black text-slate-950">{money(client, total)}</span>
              </div>
            </div>
            <p className="text-[10px] font-medium leading-4 text-slate-400">
              {client.verificationRemarks || client.description || "No additional invoice note recorded."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export function ClientDetails({ client, onBack, onViewReport }) {
  if (!client) return null;

  const isLocked = Boolean(client.isBlockchainLocked || client.blockchain?.transactionId);
  const revisionEntries = client.revisionHistory || client.corrections || [];


  return (
    <div className="ct-page p-4 md:p-8 max-w-7xl mx-auto h-full overflow-y-auto motion-page custom-scrollbar">
      {/* Sticky Back Button Container */}
      <div className="sticky top-0 z-50 mb-4 pointer-events-none">
        <button 
          onClick={onBack}
          className="pointer-events-auto p-2.5 bg-white/90 backdrop-blur hover:bg-slate-950 hover:text-white rounded-2xl transition-all border border-white/70 shadow-xl active:scale-95 text-slate-600 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Top Navigation & Title */}
      <div className="ct-section-hero flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {client.name}
              </h1>
              <span className={cn(
                "px-3 py-1 text-[10px] uppercase font-black rounded-full tracking-widest border shadow-sm",
                client.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
              )}>
                {client.paymentStatus}
              </span>
              {isLocked && ["Verified", "Locked", "Stored on Blockchain", "Tamper-Protected"].map((label) => (
                <span
                  key={label}
                  className={cn(
                    "px-3 py-1 text-[10px] uppercase font-black rounded-full tracking-widest border shadow-sm",
                    label === "Tamper-Protected"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : "bg-emerald-50 text-emerald-700 border-emerald-100",
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold text-white/62 mt-1 flex items-center gap-2">
              <MapPin size={14} className="text-white/38" />
              {client.location}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Client Reference</span>
            <span className="text-sm font-black text-white">#C-{client.id.toString().padStart(4, '0')}</span>
          </div>
          <div className="record-avatar w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-inner ring-1 ring-white/70">
            {client.initials}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pb-12">
        {/* Main Content Area */}
        <div className="xl:col-span-8 space-y-8">
          
          {/* Section 1: Basic & Identity */}
          <DetailCard icon={User} title="Entity & Identity">
            {client.companyLogo && (
              <div className="md:col-span-2 flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/70 p-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img src={client.companyLogo} alt={`${client.name} logo`} className="h-full w-full object-contain p-2" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company Logo</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{client.companyLogoName || `${client.name} logo`}</p>
                </div>
              </div>
            )}
            <DetailField label="Entity Type" value={client.type} />
            <DetailField label="Citizenship Category" value={client.category} />
            <DetailField 
              label={client.category === "Bhutanese" ? "Citizenship ID (CID)" : "Passport Number"} 
              value={client.cid || client.passport} 
            />
            {client.category === "Foreigner" && (
              <>
                <DetailField label="Work Pass Number" value={client.workPassNumber} />
                <DetailField label="Zip Code" value={client.zipCode} />
              </>
            )}
            <DetailField label="Registration Status" value="Verified & Active" />
          </DetailCard>

          {/* Section 2: Financials */}
          <DetailCard icon={Landmark} title="Financial Profile">
            <DetailField label="Contract Value" value={money(client, client.invoiceAmount ?? client.amount)} />
            <DetailField label="Ledger Journal" value={client.journalNo} />
            <DetailField label="Currency Type" value={client.currency || "BTN"} />
            <DetailField label="Invoice Date" value={client.invoiceDate} />
            <DetailField label="Description" value={client.description} fullWidth />
          </DetailCard>

          <DetailCard icon={CreditCard} title="Payment Verification">
            <DetailField label="Payment Status" value={client.paymentStatus} />
            <DetailField label="Admin Review Status" value={client.adminReviewStatus} />
            <DetailField label="Payment Sender" value={client.paymentSender} />
            <DetailField label="Payment Method" value={client.paymentMethod} />
            <DetailField label="Payment Reference" value={client.paymentReference} />
            <DetailField label="Amount Received" value={client.amountReceived ? money(client, client.amountReceived) : ""} />
            <DetailField label="Payment Date" value={client.paymentDate} />
            {client.paymentHistory?.length > 0 && (
              <div className="md:col-span-2 overflow-x-auto rounded-2xl border border-slate-100 bg-white/70">
                <div className="min-w-[38rem]">
                  <div className="grid grid-cols-[0.8fr_1.3fr_auto_auto] gap-3 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Payment Journal</span>
                    <span>Payment Evidence</span>
                    <span>Amount</span>
                    <span>Date</span>
                  </div>
                  {client.paymentHistory.map((entry) => (
                    <div key={entry.id || `${entry.reference}-${entry.date}`} className="grid grid-cols-[0.8fr_1.3fr_auto_auto] items-center gap-3 border-t border-slate-100 px-4 py-3 text-xs">
                      <p className="truncate font-mono font-black text-slate-900">{entry.journalNo || "Legacy entry"}</p>
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-900">{entry.reference || "No reference"}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{entry.method || "Payment"} / {entry.sender || "Sender not provided"}</p>
                      </div>
                      <p className="font-mono font-black text-slate-900">{money(client, entry.amount)}</p>
                      <p className="font-bold text-slate-500">{entry.date || "-"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DetailField label="Admin Audit Notes" value={client.adminReviewRemarks || client.auditNotes} fullWidth />
            <DetailField label="Verification Remarks" value={client.verificationRemarks} fullWidth />
          </DetailCard>

          <DetailCard icon={History} title="Accountability Trail">
            <DetailField label="Entered By" value={client.enteredByName || client.submittedByName} />
            <DetailField label="Entered Role / Department" value={`${client.enteredByRole || client.submittedByRole || ""} ${client.enteredByDepartment || client.submittedByDepartment ? `/ ${client.enteredByDepartment || client.submittedByDepartment}` : ""}`} />
            <DetailField label="Entry Date & Time" value={client.entryDateTime ? new Date(client.entryDateTime).toLocaleString() : ""} />
            <DetailField label="Office Presence" value={client.officePresenceStatus} />
            <DetailField label="Device / Session Status" value={client.entryDeviceStatus} />
            <DetailField label="Verified By" value={client.verifiedByName} />
            <DetailField label="Verified Date & Time" value={client.verifiedAt ? new Date(client.verifiedAt).toLocaleString() : ""} />
            <DetailField label="Approved By" value={client.approvedByName} />
            <DetailField label="Approved Date & Time" value={client.approvedAt ? new Date(client.approvedAt).toLocaleString() : ""} />
            <DetailField label="Last Updated By" value={client.lastUpdatedByName} />
            <DetailField label="Last Updated Date & Time" value={client.lastUpdatedAt ? new Date(client.lastUpdatedAt).toLocaleString() : ""} />
            <DetailField label="Duplicate Warning" value={client.duplicateJournalWarning} />
          </DetailCard>

          <DetailCard icon={Database} title="Blockchain Reference">
            <DetailField label="Fabric Transaction ID" value={client.blockchain?.transactionId} fullWidth />
            <DetailField label="Original Blockchain Hash" value={client.originalBlockchainTransactionHash || client.blockchain?.transactionId} fullWidth />
            <DetailField label="Block Number" value={client.blockchain?.blockNumber} />
            <DetailField label="Committed At" value={client.blockchain?.committedAt ? new Date(client.blockchain.committedAt).toLocaleString() : ""} />
            <DetailField label="Record Lock Status" value={client.recordLockStatus || client.lockStatus} />
            <DetailField label="Tamper Protection" value={client.tamperProtectionStatus} />
            <DetailField label="Latest Revision Status" value={client.latestRevisionStatus} />
            <DetailField label="Revision Count" value={String(client.revisionCount ?? revisionEntries.length)} />
          </DetailCard>

          {revisionEntries.length > 0 && (
            <div className="premium-card premium-card-hover p-6 rounded-[1.35rem]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-700 border border-amber-100 shadow-inner">
                  <History size={20} />
                </div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Revision History</h2>
              </div>
              <div className="space-y-3">
                {revisionEntries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-900">{entry.correctionType || "Revision"}</p>
                      <span className="w-fit rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                        {entry.status || "Submitted"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-600">{entry.reason || "No reason supplied."}</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-[10px] font-bold text-slate-500">
                      <span>Updated by {entry.createdByName || "Unknown"} on {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "Not recorded"}</span>
                      <span className="font-mono">Original hash: {entry.originalBlockchainTransactionHash || client.originalBlockchainTransactionHash}</span>
                      <span>
                        Changed fields: {(entry.changedFields || []).map((change) => `${change.field}: ${String(change.from || "empty")} -> ${String(change.to || "empty")}`).join(", ") || "No changed fields recorded"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {client.audit?.length > 0 && (
            <div className="premium-card premium-card-hover p-6 rounded-[1.35rem]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-700 border border-emerald-100 shadow-inner">
                  <History size={20} />
                </div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Audit Timeline</h2>
              </div>
              <div className="space-y-3">
                {client.audit.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-900">{entry.action}</p>
                      <p className="text-[10px] font-mono font-bold text-slate-400">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-600">{entry.details}</p>
                    <p className="mt-1 text-[10px] font-bold text-slate-400">By {entry.actorName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Project Analysis Placeholder (from DataEntry fields) */}
          <DetailCard icon={TrendingUp} title="Strategic Projections">
            <DetailField label="Capital Cost" value={client.financialData?.capitalCost ? money(client, client.financialData.capitalCost) : ""} />
            <DetailField label="Financing Cost" value={client.financialData?.financingCost ? `${client.financialData.financingCost}%` : ""} />
            <DetailField label="Capital Structure" value={client.financialData?.debtPercent ? `${client.financialData.debtPercent}% debt / ${client.financialData.equityPercent}% equity` : ""} fullWidth />
            <DetailField label="Cash Flow Analysis" value={client.financialData?.cashFlowAnalysis} fullWidth />
          </DetailCard>
        </div>

        {/* Sidebar Information */}
        <div className="xl:col-span-4 space-y-6">
          <InvoicePreview client={client} />
          
          {/* Security Banner */}
          <div className="premium-dark-panel p-8 rounded-[1.6rem] text-white relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-emerald-400 mb-6">
                <ShieldCheck size={20} className="animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">System Verified</span>
              </div>
              <h3 className="text-xl font-bold mb-4">Official Document</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-8">
                This digital record is cryptographically linked to the national financial ledger. 
                Any post-commit change is stored as a separate audit revision and does not overwrite the original ledger record.
              </p>
              <div className="space-y-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Hash Signature</p>
                  <p className="text-xs font-mono text-emerald-400/80 truncate">nz_7428_8x99_cf01_ledger</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Last Data Sync</p>
                  <p className="text-xs font-bold text-slate-200">10 May 2026, 21:24:45</p>
                </div>
              </div>
            </div>
            <div className="absolute right-[-40px] bottom-[-40px] opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Building2 size={240} />
            </div>
          </div>

          {/* Quick Access to Analysis */}
          <button 
            onClick={() => onViewReport(client)}
            className="w-full bg-emerald-800 text-white p-6 rounded-[1.6rem] flex items-center justify-between group hover:bg-slate-950 transition-all shadow-xl shadow-emerald-100 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl group-hover:scale-110 transition-transform">
                <PieChart size={24} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Insight Module</p>
                <p className="text-lg font-bold">Financial Analysis</p>
              </div>
            </div>
            <ArrowRight className="group-hover:translate-x-2 transition-transform" />
          </button>


        </div>
      </div>
    </div>
  );
}
