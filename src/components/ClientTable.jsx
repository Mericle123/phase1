import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, Download, BarChart2, X, Search, ShieldCheck, SlidersHorizontal, Edit3, Save, MessageSquare, Send } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { downloadFormattedExcel, objectsToRows } from "../lib/exportCsv";
import { api } from "../services/api";
import { currencyCodeForRecord, formatCurrencyAmount, numericCurrencyAmount } from "../lib/currency";

import BOBLogo from "../assets/BOB.png";
import BDBLLogo from "../assets/BDBL.png";
import BNBLogo from "../assets/BNB.png";
import TBankLogo from "../assets/T-Bank.jpg";
import DigitalKiduLogo from "../assets/DIgital kidu.png";

const paymentBadgeClass = {
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Partially Paid": "bg-amber-50 text-amber-700 border-amber-100",
  Pending: "bg-amber-50 text-amber-700 border-amber-100",
  Unpaid: "bg-rose-50 text-rose-700 border-rose-100",
};

const PaymentBadge = ({ value }) => (
  <span className={cn("ui-status-badge", paymentBadgeClass[value] || "bg-slate-100 text-slate-600 border-slate-200")}>
    {value === "Pending" ? "Partially Paid" : value || "Unknown"}
  </span>
);

const compactText = (value, fallback = "-") => {
  if (!value) return fallback;
  const text = String(value);
  return text.length > 18 ? `${text.slice(0, 15)}...` : text;
};

const getEnteredByName = (record) =>
  record.enteredByName || record.submittedByName || record.employeeName || record.submittedBy?.name || "Unknown Employee";

const getEnteredByRole = (record) =>
  record.enteredByRole || record.submittedByRole || record.employeeRole || record.submittedBy?.roleLabel || "Employee";

const canSeeEntryOwner = (user) => ["admin", "super_admin"].includes(user?.role);

export function ClientTable({ clients, setClients, onViewDetails, onViewReport, externalSearchQuery = "", onVerifyPayment, onUpdateInvoice, user }) {
  const [filter, setFilter] = useState("All"); // Category filter
  const [page, setPage] = useState(1);
  const [localSearchQuery, setLocalSearchQuery] = useState(externalSearchQuery);
  const [confirmAction, setConfirmAction] = useState(null); // { clientId, newStatus }
  const [lockedWarning, setLockedWarning] = useState(null);
  const [revisionSuccess, setRevisionSuccess] = useState(null);
  const [statusMenuClient, setStatusMenuClient] = useState(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [journalInput, setJournalInput] = useState("");
  const [editClient, setEditClient] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [messageClient, setMessageClient] = useState(null);
  const [messageForm, setMessageForm] = useState({ title: "Correction required", message: "" });
  const [paymentForm, setPaymentForm] = useState({
    paymentSender: "",
    paymentMethod: "Bank Transfer",
    paymentReference: "",
    amountReceived: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    verificationRemarks: "",
  });

  const banks = [
    { name: "Bank of Bhutan", logo: BOBLogo },
    { name: "Bhutan Development Bank", logo: BDBLLogo },
    { name: "Bhutan National Bank", logo: BNBLogo },
    { name: "T-Bank", logo: TBankLogo },
    { name: "Digital Kidu", logo: DigitalKiduLogo },
  ];

  const hasOpenModal = Boolean(lockedWarning || confirmAction || revisionSuccess || statusMenuClient || editClient || messageClient);
  const showEntryOwner = canSeeEntryOwner(user);
  const canEditRecord = (client) =>
    Boolean(onUpdateInvoice) &&
    (["admin", "super_admin"].includes(user?.role) || client.enteredBy === user?.id);
  const canMessageEntryOwner = (client) =>
    ["admin", "super_admin"].includes(user?.role) && client.enteredBy && client.enteredBy !== user?.id;

  const numericAmount = numericCurrencyAmount;
  const formatMoney = (record, value) => formatCurrencyAmount(value, currencyCodeForRecord(record));

  const automaticStatusFor = (record, amountReceived) => {
    const received = numericAmount(amountReceived);
    const total = numericAmount(record?.invoiceAmount ?? record?.amount);
    if (received <= 0) return "Unpaid";
    if (total > 0 && received < total) return "Partially Paid";
    return "Paid";
  };

  const paymentTotalAfterEntry = (record, entryAmount) =>
    numericAmount(record?.amountReceived) + numericAmount(entryAmount);

  const getBalanceDue = (record) =>
    Math.max(0, numericAmount(record?.invoiceAmount ?? record?.amount) - numericAmount(record?.amountReceived));

  useEffect(() => {
    if (!hasOpenModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasOpenModal]);

  useEffect(() => {
    if (!editClient) return;
    requestAnimationFrame(() => {
      document.querySelector("[data-record-edit-body]")?.scrollTo({ top: 0 });
      document.getElementById("record-edit-first-field")?.focus({ preventScroll: true });
    });
  }, [editClient]);

  const filteredClients = useMemo(() => {
    const query = localSearchQuery.toLowerCase().trim();
    return clients.filter(client => {
      const matchesCategory = filter === "All" || client.category === filter;
      
      if (!query) return matchesCategory;

      const searchableString = [
        client.name,
        client.location,
        client.type,
        client.category,
        client.cid,
        client.passport,
        client.journalNo,
        client.amount,
        client.bank,
        client.paymentStatus,
        showEntryOwner ? getEnteredByName(client) : "",
        showEntryOwner ? getEnteredByRole(client) : "",
      ].join(" ").toLowerCase();

      const matchesSearch = searchableString.includes(query);
      return matchesSearch && matchesCategory;
    });
  }, [localSearchQuery, filter, clients, showEntryOwner]);


  const itemsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / itemsPerPage));
  const currentClients = filteredClients.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleExport = () => {
    try {
      const exportData = filteredClients.map(c => ({
        "Client Name": c.name,
        "Entity Type": c.type,
        "Location": c.location,
        "Category": c.category,
        "Official ID": c.cid || c.passport || "---",
        "Contract Amount": formatMoney(c, c.invoiceAmount ?? c.amount),
        "Payment Status": c.paymentStatus,
        ...(showEntryOwner ? { "Entered By": getEnteredByName(c), "Entered Role": getEnteredByRole(c) } : {}),
        "Journal Number": c.journalNo || "---",
        "Bank": c.bank || "---",
        "Audit Status": c.auditStatus?.finalized ? "Verified" : "Pending"
      }));

      downloadFormattedExcel(`NZ_Britannia_Records_${new Date().toISOString().split('T')[0]}.xls`, objectsToRows(exportData), {
        title: "Client Directory Records",
        subtitle: "Filtered NZ Britannia client ledger with payment, journal, ownership, and verification status.",
        sheetName: "Client Records",
      });
      
      toast.success("Export Successful", {
        description: "Formatted client ledger workbook has been generated."
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export Failed", { description: "Could not generate the formatted workbook." });
    }
  };


  const openPaymentEditor = (clientId, newStatus, isBlockchainRevision = false) => {
    const targetClient = clients.find(c => c.id === clientId);
    setConfirmAction({ clientId, newStatus, isBlockchainRevision });
    setJournalInput(targetClient?.journalNo || "");
    const invoiceAmount = numericAmount(targetClient?.invoiceAmount ?? targetClient?.amount);
    const currentAmount = numericAmount(targetClient?.amountReceived);
    const balance = Math.max(0, invoiceAmount - currentAmount);
    const suggestedAmount =
      newStatus === "Paid"
        ? balance || invoiceAmount
        : newStatus === "Partially Paid"
          ? Math.max(1, Math.floor((balance || invoiceAmount) / 2))
          : 0;
    setPaymentForm({
      paymentSender: targetClient?.paymentSender || "",
      paymentMethod: targetClient?.paymentMethod || "Bank Transfer",
      paymentReference: targetClient?.paymentReference || "",
      amountReceived: suggestedAmount || "",
      paymentDate: targetClient?.paymentDate || new Date().toISOString().slice(0, 10),
      verificationRemarks: targetClient?.verificationRemarks || "",
    });
  };

  const handlePaymentAction = (clientId, newStatus) => {
    if (!onVerifyPayment) {
      toast.error("Access Restricted", { description: "Only administrators can update payment status." });
      return;
    }
    const targetClient = clients.find(c => c.id === clientId);
    if (targetClient?.paymentStatus === newStatus && newStatus !== "Partially Paid") {
      toast.info(`Already ${newStatus}`, { description: "This record is already using the selected payment status." });
      return;
    }
    if (targetClient?.isBlockchainLocked || targetClient?.blockchain?.transactionId) {
      setRevisionReason("");
      setLockedWarning({ clientId, newStatus });
      return;
    }
    openPaymentEditor(clientId, newStatus);
  };

  const openRecordEditor = (client) => {
    setEditClient(client);
    setEditForm({
      clientName: client.clientName || client.name || "",
      clientType: client.clientType || client.type || "",
      citizenship: client.citizenship || client.category || "",
      cid: client.cid || "",
      passport: client.passport || "",
      country: client.country || "",
      location: client.location || "",
      organizationName: client.organizationName || client.name || "",
      invoiceDate: client.invoiceDate || "",
      journalNo: client.journalNo || "",
      invoiceAmount: client.invoiceAmount ?? client.amount ?? "",
      currency: client.currency || "BTN",
      description: client.description || "",
      verificationRemarks: client.verificationRemarks || "",
    });
  };

  const saveRecordEdit = async () => {
    if (!editClient || !onUpdateInvoice) return;
    try {
      const updatedInvoice = await onUpdateInvoice(editClient.id, editForm);
      setEditClient(null);
      setEditForm({});
      toast.success("Record updated", { description: `${updatedInvoice.clientName || updatedInvoice.name} has been corrected.` });
    } catch (error) {
      toast.error("Correction failed", { description: error.message });
    }
  };

  const openMessageEditor = (client) => {
    setMessageClient(client);
    setMessageForm({
      title: `Correction required: ${client.journalNo || client.name}`,
      message: "",
    });
  };

  const sendEntryMessage = async () => {
    if (!messageClient) return;
    try {
      await api.sendNotification({
        target: messageClient.enteredBy,
        title: messageForm.title,
        message: messageForm.message,
      });
      setMessageClient(null);
      setMessageForm({ title: "Correction required", message: "" });
      toast.success("Message sent", { description: `${getEnteredByName(messageClient)} will see it in notifications.` });
    } catch (error) {
      toast.error("Message failed", { description: error.message });
    }
  };


  const executeAction = async () => {
    if (confirmAction) {
      const targetClient = clients.find(c => c.id === confirmAction.clientId);
      if (confirmAction.isBlockchainRevision && !revisionReason.trim()) {
        toast.error("Revision reason required", { description: "Please explain why this locked blockchain record needs an update." });
        return;
      }
      if (confirmAction.newStatus !== "Unpaid") {

        if (!journalInput.trim()) {
          toast.error("Journal Number Required", { description: "Please enter a journal number for this payment entry." });
          return;
        }
        if (numericAmount(paymentForm.amountReceived) <= 0) {
          toast.error("Payment Amount Required", { description: "Enter the amount received for this payment entry." });
          return;
        }

        const journalExists = clients.some(c => 
          c.id !== confirmAction.clientId && 
          c.journalNo && c.journalNo.trim().toLowerCase() === journalInput.trim().toLowerCase()
        );

        if (journalExists) {
          toast.error("Double Entry Blocked", { 
            description: `Journal number "${journalInput}" is already assigned to another record.` 
          });
          return;
        }
      }

      try {
        let updatedInvoice = null;
        if (onVerifyPayment) {
          updatedInvoice = await onVerifyPayment(confirmAction.clientId, {
            paymentStatus: confirmAction.newStatus,
            journalNo: journalInput,
            bank: targetClient?.bank || "",
            ...paymentForm,
            recordPartPayment: confirmAction.newStatus !== "Unpaid",
            paymentEntry: confirmAction.newStatus !== "Unpaid"
              ? {
                  amount: paymentForm.amountReceived,
                  sender: paymentForm.paymentSender,
                  method: paymentForm.paymentMethod,
                  reference: paymentForm.paymentReference,
                  date: paymentForm.paymentDate,
                  remarks: paymentForm.verificationRemarks,
                }
              : undefined,
            ...(confirmAction.isBlockchainRevision
              ? {
                  confirmBlockchainRevision: true,
                  revisionReason: revisionReason.trim(),
                }
              : {}),
          });
        } else {
          setClients(clients.map(c =>
            c.id === confirmAction.clientId
              ? { 
                  ...c, 
                  paymentStatus: confirmAction.newStatus, 
                  journalNo: confirmAction.newStatus === "Paid" ? journalInput : c.journalNo,
                  bank: c.bank || ""
                }
              : c
          ));
        }
        if (confirmAction.isBlockchainRevision) {
          setRevisionSuccess({
            clientName: targetClient?.name || "Record",
            journalNo: targetClient?.journalNo || journalInput,
          });
        } else {
          const finalStatus = updatedInvoice?.paymentStatus || automaticStatusFor(targetClient, paymentTotalAfterEntry(targetClient, paymentForm.amountReceived));
          toast.success(`Invoice marked as ${finalStatus}`, {
            description: finalStatus === "Paid" ? "Fabric transaction reference has been recorded." : "Audit log updated.",
          });
        }
        setConfirmAction(null);
        setJournalInput("");
        setRevisionReason("");
      } catch (error) {
        toast.error("Status update failed", { description: error.message });
      }
    }
  };


  return (
    <>
      <div className="premium-card rounded-[1.35rem] overflow-hidden ledger-search-card">
        <div className="p-4 sm:p-6 border-b border-slate-200/70 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
            <h2 className="text-lg font-bold text-slate-900">Client Records</h2>
            <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-white shadow-inner w-full sm:w-auto">
              {["All", "Bhutanese", "Foreigner"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setFilter(cat); setPage(1); }}
                  className={cn(
                    "flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200",
                    filter === cat ? "bg-white shadow-md shadow-slate-200/70 text-slate-950" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {cat === "Foreigner" ? "Foreign" : cat}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-72 group search-shell">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search clients..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="premium-input w-full rounded-2xl py-2.5 pl-10 pr-10 text-sm outline-none transition-all"
              />
              {localSearchQuery && (
                <button 
                  onClick={() => setLocalSearchQuery("")}
                  aria-label="Clear search"
                  className="no-motion absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2 relative">
            <button
              onClick={handleExport}
              aria-label="Export ledger as Excel"
              className="p-2.5 border border-slate-200 rounded-2xl hover:bg-white text-slate-500 hover:text-blue-700 hover:border-blue-100 transition-all shadow-sm active:scale-95"
              title="Export as Excel"
            >
              <Download size={18} />
            </button>

          </div>

        </div>

        <div className="ui-table-scroll custom-scrollbar">
          <table className="ui-table ledger-table">
            <thead>
              <tr>
                <th className={showEntryOwner ? "w-[22%]" : "w-[25%]"}>Client</th>
                <th className={showEntryOwner ? "w-[13%]" : "w-[14%]"}>Type</th>
                {showEntryOwner && <th className="w-[19%]">Entered By</th>}
                <th className={showEntryOwner ? "w-[11%]" : "w-[13%]"}>Amount</th>
                <th className={showEntryOwner ? "w-[11%]" : "w-[14%]"}>Payment</th>
                <th className={showEntryOwner ? "w-[14%]" : "w-[18%]"}>Journal</th>
                <th className="ui-action-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {currentClients.map((client) => (
                <tr key={client.id} className="group">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="record-avatar row-avatar w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold shadow-inner ring-1 ring-white/70">
                        {client.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-bold text-slate-900 group-hover:text-blue-600 transition-colors" title={client.name}>{client.name}</p>
                          {client.auditStatus?.finalized && (
                            <div className="text-emerald-500" title="Audited">
                              <ShieldCheck size={14} />
                            </div>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {client.category} / {client.cid || client.passport || "No ID"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="truncate text-xs font-bold text-slate-700" title={client.type}>{client.type}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{client.location || "No location"}</p>
                  </td>
                  {showEntryOwner && (
                    <td>
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-black text-slate-900" title={getEnteredByName(client)}>{getEnteredByName(client)}</p>
                        {canMessageEntryOwner(client) && (
                          <button
                            type="button"
                            onClick={() => openMessageEditor(client)}
                            className="ui-icon-btn h-7 min-h-7 w-7 min-w-7 text-blue-700"
                            title="Message employee"
                            aria-label="Message employee"
                          >
                            <MessageSquare size={13} />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[10px] font-black uppercase tracking-widest text-slate-400" title={getEnteredByRole(client)}>
                        {getEnteredByRole(client)}
                      </p>
                    </td>
                  )}

                  <td className="font-bold text-slate-900 whitespace-nowrap">
                    <span className="text-slate-500 font-medium text-xs mr-1">Nu.</span>
                    {client.amount}
                  </td>
                  <td>
                    <PaymentBadge value={client.paymentStatus} />
                    {client.paymentStatus === "Paid" && client.blockchain?.transactionId && (
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-600">Locked</p>
                    )}
                  </td>
                  <td>
                    <div className="min-w-0">
                      <span className="text-slate-700 font-mono text-xs font-bold rounded-full bg-slate-100 px-2.5 py-1 border border-slate-200 w-fit">
                        {client.journalNo || "-"}
                      </span>
                      {client.paymentStatus === "Paid" && client.bank && (
                        <div className="flex items-center gap-1 mt-1">
                          <img 
                            src={banks.find(b => b.name === client.bank)?.logo || BOBLogo} 
                            alt={client.bank} 
                            className="h-3 w-auto object-contain"
                          />
                          <span className="text-[10px] text-slate-400">{client.bank}</span>
                        </div>
                      )}
                      {client.blockchain?.transactionId && (
                        <>
                          <span className="mt-1 block max-w-[11rem] truncate text-[9px] font-mono text-blue-600" title={client.blockchain.transactionId}>
                            {compactText(client.blockchain.transactionId)}
                          </span>
                          <div className="mt-2 flex max-w-[12rem] flex-wrap gap-1.5">
                            {["Stored", "Protected"].map((label) => (
                              <span
                                key={label}
                                className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-700"
                              >
                                {label}
                              </span>
                            ))}
                            {client.latestRevisionStatus && client.latestRevisionStatus !== "No Revisions" && (
                              <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-700">
                                Revision: {client.latestRevisionStatus}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="ui-action-cell">
                    <div className="ui-table-actions">
                      <button
                        onClick={() => onViewDetails && onViewDetails(client)}
                        className="ui-icon-btn"
                        title="View Details"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => onViewReport && onViewReport(client)}
                        className="ui-icon-btn"
                        title="View Report"
                      >
                        <BarChart2 size={15} />
                      </button>
                      {canEditRecord(client) && (
                        <button
                          onClick={() => openRecordEditor(client)}
                          className="ui-icon-btn text-blue-700"
                          title="Edit record"
                          aria-label="Edit record"
                        >
                          <Edit3 size={15} />
                        </button>
                      )}
                      {onVerifyPayment && getBalanceDue(client) > 0 && (
                        <button
                          onClick={() => handlePaymentAction(client.id, "Paid")}
                          className="ui-btn ui-btn-sm ui-btn-primary"
                          title={`Outstanding balance: ${formatMoney(client, getBalanceDue(client))}`}
                        >
                          Pay Remaining Balance
                        </button>
                      )}
                      {onVerifyPayment && client.paymentStatus !== "Paid" && (
                        <button
                          onClick={() => setStatusMenuClient(client)}
                          className="ui-btn ui-btn-sm ui-btn-soft"
                        >
                          <SlidersHorizontal size={13} />
                          Status
                        </button>
                      )}
                      {onVerifyPayment && client.paymentStatus === "Paid" && (
                        <button
                          onClick={() => setStatusMenuClient(client)}
                          className="ui-btn ui-btn-sm ui-btn-secondary"
                        >
                          <SlidersHorizontal size={13} />
                          Status
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {currentClients.length === 0 && (
                <tr>
                  <td colSpan={showEntryOwner ? 7 : 6} className="px-6 py-16 text-center text-slate-500">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                        <Search size={20} />
                      </div>
                      <p className="font-bold text-slate-900">No clients found</p>
                      <p className="text-sm">Try a different search term or adjust the ledger filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ui-card-list">
          {currentClients.map((client) => (
            <article key={client.id} className="ui-mobile-record">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black text-slate-950">{client.name}</h3>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {client.type} / {client.category}
                  </p>
                </div>
                <PaymentBadge value={client.paymentStatus} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Amount</p>
                  <p className="mt-1 font-bold text-slate-900">{formatMoney(client, client.invoiceAmount ?? client.amount)}</p>
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Journal</p>
                  <p className="mt-1 font-mono font-bold text-slate-700">{client.journalNo || "-"}</p>
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">ID</p>
                  <p className="mt-1 font-mono font-bold text-slate-700">{client.cid || client.passport || "-"}</p>
                </div>
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-400">Bank</p>
                  <p className="mt-1 font-bold text-slate-700">{client.bank || "-"}</p>
                </div>
                {showEntryOwner && (
                  <div className="col-span-2">
                    <p className="font-black uppercase tracking-widest text-slate-400">Entered By</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="font-bold text-slate-800">{getEnteredByName(client)}</p>
                      {canMessageEntryOwner(client) && (
                        <button type="button" onClick={() => openMessageEditor(client)} className="ui-btn ui-btn-sm ui-btn-soft">
                          <MessageSquare size={14} />
                          Message
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button onClick={() => onViewDetails && onViewDetails(client)} className="ui-btn ui-btn-sm ui-btn-soft">
                  <Eye size={14} />
                  Details
                </button>
                <button onClick={() => onViewReport && onViewReport(client)} className="ui-btn ui-btn-sm ui-btn-secondary">
                  <BarChart2 size={14} />
                  Report
                </button>
                {canEditRecord(client) && (
                  <button onClick={() => openRecordEditor(client)} className="ui-btn ui-btn-sm ui-btn-secondary">
                    <Edit3 size={14} />
                    Edit
                  </button>
                )}
                {onVerifyPayment && (
                  <button onClick={() => setStatusMenuClient(client)} className="ui-btn ui-btn-sm ui-btn-primary">
                    <SlidersHorizontal size={14} />
                    Status
                  </button>
                )}
                {onVerifyPayment && getBalanceDue(client) > 0 && (
                  <button onClick={() => handlePaymentAction(client.id, "Paid")} className="ui-btn ui-btn-sm ui-btn-primary">
                    Pay Remaining Balance
                  </button>
                )}
              </div>
            </article>
          ))}
          {currentClients.length === 0 && (
            <div className="px-6 py-14 text-center text-slate-500">
              <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Search size={20} />
                </div>
                <p className="font-bold text-slate-900">No clients found</p>
                <p className="text-sm">Try a different search term or adjust the ledger filter.</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/45">
          <p className="text-xs text-slate-500">
            Showing {Math.min(currentClients.length, itemsPerPage)} of {filteredClients.length} clients
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="ui-icon-btn"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={cn(
                  "ui-icon-btn text-xs font-bold",
                  page === i + 1
                    ? "border-blue-100 bg-blue-50 text-blue-700 shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="ui-icon-btn"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {messageClient && (
        <div className="ui-modal-backdrop" role="presentation" onClick={() => setMessageClient(null)}>
          <div
            className="glass-panel ui-modal-panel max-w-lg motion-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-message-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ui-modal-header border-b border-slate-200/70 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Message Employee</p>
                  <h3 id="entry-message-title" className="mt-2 text-xl font-black text-slate-950">{getEnteredByName(messageClient)}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    About {messageClient.name} / {messageClient.journalNo || "No journal"}
                  </p>
                </div>
                <button type="button" onClick={() => setMessageClient(null)} className="ui-icon-btn" aria-label="Close message composer">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="ui-modal-body custom-scrollbar p-5 sm:p-6">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subject</span>
                <input
                  value={messageForm.title}
                  onChange={(event) => setMessageForm((current) => ({ ...current, title: event.target.value }))}
                  className="premium-input mt-2 w-full rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 outline-none"
                />
              </label>
              <label className="mt-4 block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Correction Message</span>
                <textarea
                  rows={5}
                  value={messageForm.message}
                  onChange={(event) => setMessageForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Explain the mistake and what needs to be changed..."
                  className="premium-input mt-2 w-full resize-none rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none"
                />
              </label>
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => setMessageClient(null)} className="ui-btn ui-btn-md ui-btn-secondary flex-1">
                  Cancel
                </button>
                <button type="button" onClick={sendEntryMessage} className="ui-btn ui-btn-md ui-btn-primary flex-1">
                  <Send size={17} />
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editClient && (
        <div className="ui-modal-backdrop" role="presentation" onClick={() => setEditClient(null)}>
          <div
            className="glass-panel ui-modal-panel max-w-3xl motion-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ui-modal-header border-b border-slate-200/70 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Record Correction</p>
                  <h3 id="record-edit-title" className="mt-2 text-xl font-black text-slate-950">{editClient.name}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Correct entry mistakes without changing payment verification workflow.
                  </p>
                </div>
                <button type="button" onClick={() => setEditClient(null)} className="ui-icon-btn" aria-label="Close record editor">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="ui-modal-body custom-scrollbar p-5 sm:p-6" data-record-edit-body>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  ["clientName", "Client Name"],
                  ["organizationName", "Organization"],
                  ["clientType", "Entity Type"],
                  ["citizenship", "Citizenship"],
                  ["cid", "CID"],
                  ["passport", "Passport / Foreign ID"],
                  ["country", "Country"],
                  ["location", "Location"],
                  ["journalNo", "Journal Number"],
                  ["invoiceAmount", "Invoice Amount"],
                  ["currency", "Currency"],
                  ["invoiceDate", "Invoice Date"],
                ].map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                    <input
                      type={field === "invoiceDate" ? "date" : "text"}
                      id={field === "clientName" ? "record-edit-first-field" : undefined}
                      autoFocus={field === "clientName"}
                      value={editForm[field] || ""}
                      onChange={(event) => setEditForm((current) => ({
                        ...current,
                        [field]: ["cid", "invoiceAmount"].includes(field) ? event.target.value.replace(/\D/g, "") : event.target.value,
                      }))}
                      className="premium-input mt-2 w-full rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none"
                    />
                  </label>
                ))}
                <label className="block md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</span>
                  <textarea
                    rows={3}
                    value={editForm.description || ""}
                    onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                    className="premium-input mt-2 w-full resize-none rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Correction Note</span>
                  <textarea
                    rows={2}
                    value={editForm.verificationRemarks || ""}
                    onChange={(event) => setEditForm((current) => ({ ...current, verificationRemarks: event.target.value }))}
                    placeholder="Briefly describe what was corrected..."
                    className="premium-input mt-2 w-full resize-none rounded-2xl px-4 py-3 text-sm text-slate-900 outline-none"
                  />
                </label>
              </div>
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => setEditClient(null)} className="ui-btn ui-btn-md ui-btn-secondary flex-1">
                  Cancel
                </button>
                <button type="button" onClick={saveRecordEdit} className="ui-btn ui-btn-md ui-btn-primary flex-1">
                  <Save size={17} />
                  Save Correction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {lockedWarning && (
        <div className="ui-modal-backdrop">
          <div className="glass-panel ui-modal-panel max-w-lg motion-pop">
            <div className="ui-modal-body custom-scrollbar p-6 sm:p-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-inner">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-950">Verified Record Is Locked</h3>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                Are you sure you want to update this verified record? This record has already been confirmed and stored on the blockchain. Any update will be logged as a new revision and will not overwrite the original blockchain record.
              </p>
              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs font-bold leading-5 text-blue-800">
                Original blockchain hash and payment evidence will remain unchanged. The next step asks for a revision reason for audit tracking.
              </div>
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setLockedWarning(null)}
                className="ui-btn ui-btn-md ui-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  openPaymentEditor(lockedWarning.clientId, lockedWarning.newStatus, true);
                  setLockedWarning(null);
                }}
                className="ui-btn ui-btn-md ui-btn-primary flex-1"
              >
                Continue
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {statusMenuClient && (
        <div className="ui-modal-backdrop" role="presentation" onClick={() => setStatusMenuClient(null)}>
          <div
            className="glass-panel ui-modal-panel max-w-md motion-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-status-actions-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ui-modal-header border-b border-slate-200/70 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Payment Status</p>
                  <h3 id="payment-status-actions-title" className="mt-2 text-xl font-black text-slate-950">
                    {statusMenuClient.name}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Current status: <span className="font-black text-slate-800">{statusMenuClient.paymentStatus}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusMenuClient(null)}
                  className="ui-icon-btn"
                  aria-label="Close payment status actions"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="ui-modal-body custom-scrollbar p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-3">
                {[
                  ["Paid", "Record Full Payment", "ui-btn-primary"],
                  ["Partially Paid", "Record Part Payment", "ui-btn-secondary"],
                  ["Unpaid", "Record No Payment", "ui-btn-danger"],
                ].map(([status, label, tone]) => {
                  const isCurrent = statusMenuClient.paymentStatus === status;
                  const disabled = isCurrent && status !== "Partially Paid";
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const clientId = statusMenuClient.id;
                        setStatusMenuClient(null);
                        handlePaymentAction(clientId, status);
                      }}
                      className={cn("ui-btn ui-btn-md w-full", tone, isCurrent && "ring-2 ring-slate-200")}
                    >
                      {label}
                      {isCurrent && <span className="ml-1 text-[10px] font-black uppercase tracking-widest opacity-70">{status === "Partially Paid" ? "Add More" : "Current"}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
              <button type="button" onClick={() => setStatusMenuClient(null)} className="ui-btn ui-btn-md ui-btn-secondary w-full">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmAction && (
        <div className="ui-modal-backdrop">
          <div className="glass-panel ui-modal-panel max-w-md motion-pop">
            <div className="ui-modal-body custom-scrollbar p-5 sm:p-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-6 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {clients.find(c => c.id === confirmAction.clientId)?.paymentStatus === "Paid" ? "Update Payment Record" : "Confirm Payment"}
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              {clients.find(c => c.id === confirmAction.clientId)?.paymentStatus === "Paid" 
                ? `You are updating the journal and bank records for ${clients.find(c => c.id === confirmAction.clientId)?.name}.`
                : `Record the payment received now. The system adds it to previous receipts and updates the status automatically.`}
            </p>

            {confirmAction.isBlockchainRevision && (
              <div className="mb-6 space-y-4">
                <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 text-amber-600" size={18} />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-amber-800">New Audit Revision</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                        The original blockchain record will stay unchanged. This update will be saved as a revision with who changed it, when, what changed, and why.
                      </p>
                    </div>
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Revision Reason <span className="text-rose-500">*</span>
                  </span>
                  <textarea
                    rows={3}
                    value={revisionReason}
                    onChange={(event) => setRevisionReason(event.target.value)}
                    placeholder="Explain why this locked blockchain record needs a revision..."
                    className="premium-input mt-2 w-full rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none"
                  />
                </label>
              </div>
            )}

            {confirmAction.newStatus !== "Unpaid" && (
              <div className="space-y-6 mb-8">
                <div className="rounded-lg border border-[var(--ct-line)] bg-[var(--ct-green-50)]/80 px-4 py-3 text-sm font-bold text-[var(--ct-charcoal)]">
                  Outstanding balance:{" "}
                  <span className="font-mono text-[var(--ct-primary-emerald)]">
                    {formatMoney(
                      clients.find(c => c.id === confirmAction.clientId),
                      getBalanceDue(clients.find(c => c.id === confirmAction.clientId)),
                    )}
                  </span>
                </div>
                <div className={cn(
                  "rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-widest",
                  automaticStatusFor(
                    clients.find(c => c.id === confirmAction.clientId),
                    paymentTotalAfterEntry(clients.find(c => c.id === confirmAction.clientId), paymentForm.amountReceived),
                  ) === "Paid"
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : "border-amber-100 bg-amber-50 text-amber-700",
                )}>
                  Automatic status: {automaticStatusFor(
                    clients.find(c => c.id === confirmAction.clientId),
                    paymentTotalAfterEntry(clients.find(c => c.id === confirmAction.clientId), paymentForm.amountReceived),
                  )}
                  <span className="ml-2 opacity-70">
                    Current {formatMoney(clients.find(c => c.id === confirmAction.clientId), clients.find(c => c.id === confirmAction.clientId)?.amountReceived)} + This payment {formatMoney(clients.find(c => c.id === confirmAction.clientId), paymentForm.amountReceived)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Journal Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={journalInput}
                    onChange={(e) => setJournalInput(e.target.value)}
                    placeholder="e.g. J-8472"
                    autoFocus
                    className="premium-input w-full rounded-2xl py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Payment Sender <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentForm.paymentSender}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentSender: e.target.value }))}
                      placeholder="Sender name"
                      className="premium-input w-full rounded-2xl py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Method <span className="text-rose-500">*</span>
                    </label>
                  <select
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="premium-input ui-select w-full rounded-2xl py-3 px-4 text-sm text-slate-900 outline-none"
                    >
                      <option>Bank Transfer</option>
                      <option>Cheque</option>
                      <option>Cash Deposit</option>
                      <option>Digital Payment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Payment Reference <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentForm.paymentReference}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentReference: e.target.value }))}
                      placeholder="Bank reference"
                      className="premium-input w-full rounded-2xl py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {confirmAction.newStatus === "Paid" ? "Payment Amount" : "Part Payment Amount"} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={paymentForm.amountReceived}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, amountReceived: e.target.value }))}
                      className="premium-input w-full rounded-2xl py-3 px-4 text-sm text-slate-900 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Payment Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                      className="premium-input w-full rounded-2xl py-3 px-4 text-sm text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {confirmAction.newStatus === "Unpaid" && (
              <div className="mb-8">
                <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-rose-700">
                  Automatic status: Unpaid
                </div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Verification Remarks
                </label>
                <textarea
                  rows={3}
                  value={paymentForm.verificationRemarks}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, verificationRemarks: e.target.value }))}
                  placeholder="Add a short reason or review note..."
                  className="premium-input w-full rounded-2xl py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none"
                />
              </div>
            )}
            </div>
            <div className="ui-modal-footer border-t border-slate-200/70 bg-white/70 p-4 sm:p-5">
              <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => setConfirmAction(null)}
                className="ui-btn ui-btn-md ui-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                className="ui-btn ui-btn-md ui-btn-primary flex-1"
              >
                {confirmAction.isBlockchainRevision ? "Submit Revision" : "Confirm"}
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
    </>
  );
}
