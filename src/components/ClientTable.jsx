import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, CircleOff, Eye, Download, BarChart2, PieChart, ReceiptText, X, Search, ShieldCheck, SlidersHorizontal, Edit3, Save, MessageSquare, Send } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { downloadFormattedExcel, objectsToRows } from "../lib/exportCsv";
import { api } from "../services/api";
import { currencyCodeForRecord, formatCurrencyAmount, numericCurrencyAmount } from "../lib/currency";

import BOBLogo from "../assets/BOB.png";
import BDBLLogo from "../assets/BDBL.png";
import BNBLogo from "../assets/BNB.png";
import TBankLogo from "../assets/T-Bank.jpg";
import DigitalKiduLogo from "../assets/Digital-Kidu.png";

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

const canSeeEntryOwner = (user) => ["verifier", "admin", "super_admin"].includes(user?.role);

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
    bank: "",
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
    (["verifier", "admin", "super_admin"].includes(user?.role) || client.enteredBy === user?.id);
  const canMessageEntryOwner = (client) =>
    ["verifier", "admin", "super_admin"].includes(user?.role) && client.enteredBy && client.enteredBy !== user?.id;

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
  const activePaymentClient = confirmAction ? clients.find((client) => client.id === confirmAction.clientId) : null;
  const activePaymentBalance = getBalanceDue(activePaymentClient);
  const activePaymentTotal = numericAmount(activePaymentClient?.invoiceAmount ?? activePaymentClient?.amount);
  const activePaymentReceived = numericAmount(activePaymentClient?.amountReceived);
  const activePaymentEntryAmount = numericAmount(paymentForm.amountReceived);
  const projectedPaymentReceived = Math.min(activePaymentTotal, activePaymentReceived + activePaymentEntryAmount);
  const projectedPaymentBalance = Math.max(0, activePaymentTotal - projectedPaymentReceived);
  const activePaymentProgress = activePaymentTotal > 0
    ? Math.min(100, Math.round((activePaymentReceived / activePaymentTotal) * 100))
    : 0;
  const projectedPaymentProgress = activePaymentTotal > 0
    ? Math.min(100, Math.round((projectedPaymentReceived / activePaymentTotal) * 100))
    : 0;
  const projectedPaymentStatus = activePaymentClient
    ? automaticStatusFor(activePaymentClient, paymentTotalAfterEntry(activePaymentClient, paymentForm.amountReceived))
    : "Unpaid";

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
        "Invoice Journal": c.journalNo || "---",
        "Payment Journals": (c.paymentHistory || []).map((entry) => entry.journalNo).filter(Boolean).join(", ") || "---",
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
    setJournalInput("");
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
      paymentMethod: /transfer/i.test(targetClient?.paymentMethod || "") ? "Bank Transfer" : targetClient?.paymentMethod || "Bank Transfer",
      bank: targetClient?.bank || "",
      paymentReference: "",
      amountReceived: suggestedAmount || "",
      paymentDate: new Date().toISOString().slice(0, 10),
      verificationRemarks: targetClient?.verificationRemarks || "",
    });
  };

  const handlePaymentAction = (clientId, newStatus) => {
    if (!onVerifyPayment) {
      toast.error("Access Restricted", { description: "Only Verifiers and administrators can update payment status." });
      return;
    }
    const targetClient = clients.find(c => c.id === clientId);
    if (!targetClient) return;
    if (newStatus !== "Unpaid" && getBalanceDue(targetClient) <= 0) {
      toast.info("Payment already complete", { description: "Open Status or Details to review the payment journal history." });
      return;
    }
    if (newStatus === "Unpaid" && numericAmount(targetClient.amountReceived) > 0) {
      toast.error("Recorded payments cannot be erased", {
        description: "This invoice has payment journal entries. Add the remaining payment or submit a correction instead.",
      });
      return;
    }
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
        if (numericAmount(paymentForm.amountReceived) > getBalanceDue(targetClient)) {
          toast.error("Payment Exceeds Balance", {
            description: `The largest payment allowed is ${formatMoney(targetClient, getBalanceDue(targetClient))}.`,
          });
          return;
        }
        if (paymentForm.paymentMethod === "Bank Transfer" && !paymentForm.bank.trim()) {
          toast.error("Financial Institution Required", {
            description: "Select the bank that handled this transfer.",
          });
          return;
        }

        const normalizedJournal = journalInput.trim().toLowerCase();
        const journalExists = clients.some(c =>
          String(c.journalNo || "").trim().toLowerCase() === normalizedJournal ||
          (c.paymentHistory || []).some(entry => String(entry.journalNo || "").trim().toLowerCase() === normalizedJournal)
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
            bank: targetClient?.bank || "",
            ...paymentForm,
            recordPartPayment: confirmAction.newStatus !== "Unpaid",
            paymentEntry: confirmAction.newStatus !== "Unpaid"
              ? {
                  journalNo: journalInput,
                  amount: paymentForm.amountReceived,
                  sender: paymentForm.paymentSender,
                  method: paymentForm.paymentMethod,
                  bank: paymentForm.paymentMethod === "Bank Transfer" ? paymentForm.bank : "",
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
                  paymentHistory: confirmAction.newStatus === "Unpaid"
                    ? c.paymentHistory || []
                    : [...(c.paymentHistory || []), { journalNo: journalInput, amount: paymentForm.amountReceived }],
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
            description: confirmAction.newStatus === "Unpaid"
              ? "No payment has been recorded."
              : `Payment journal ${journalInput} was added without changing invoice journal ${targetClient?.journalNo}.`,
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
                    {formatMoney(client, client.invoiceAmount ?? client.amount)}
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

      {statusMenuClient && createPortal(
        <div className="ui-modal-backdrop payment-workspace-backdrop" role="presentation" onClick={() => setStatusMenuClient(null)}>
          <div
            className="ui-modal-panel payment-status-modal motion-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-status-actions-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ui-modal-header flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
                  <ReceiptText size={19} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Payment Control</p>
                  <h3 id="payment-status-actions-title" className="mt-1 truncate text-lg font-black text-slate-950">{statusMenuClient.name}</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">Review the ledger and choose the next payment action.</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PaymentBadge value={statusMenuClient.paymentStatus} />
                <button type="button" onClick={() => setStatusMenuClient(null)} className="ui-icon-btn" aria-label="Close payment status actions">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="ui-modal-body custom-scrollbar p-0">
              <div className="grid min-h-0 lg:grid-cols-[0.92fr_1.08fr]">
                <section className="p-5 sm:p-6">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-slate-200 pb-5 text-xs">
                    <div>
                      <p className="font-black uppercase tracking-widest text-slate-400">Invoice Journal</p>
                      <p className="mt-1 font-mono text-sm font-black text-slate-900">{statusMenuClient.journalNo || "-"}</p>
                    </div>
                    <div>
                      <p className="font-black uppercase tracking-widest text-slate-400">Invoice Total</p>
                      <p className="mt-1 font-mono text-sm font-black text-slate-900">{formatMoney(statusMenuClient, statusMenuClient.invoiceAmount ?? statusMenuClient.amount)}</p>
                    </div>
                    <div>
                      <p className="font-black uppercase tracking-widest text-slate-400">Received</p>
                      <p className="mt-1 font-mono text-sm font-black text-emerald-700">{formatMoney(statusMenuClient, statusMenuClient.amountReceived)}</p>
                    </div>
                    <div>
                      <p className="font-black uppercase tracking-widest text-slate-400">Balance Due</p>
                      <p className="mt-1 font-mono text-sm font-black text-slate-900">{formatMoney(statusMenuClient, getBalanceDue(statusMenuClient))}</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Next action</p>
                    <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {[
                        { status: "Paid", label: "Pay remaining balance", description: "Record the full outstanding amount", Icon: CircleDollarSign },
                        { status: "Partially Paid", label: "Add part payment", description: "Record another payment and keep the balance open", Icon: PieChart },
                        { status: "Unpaid", label: "Confirm no payment", description: "Use only when no payment has been recorded", Icon: CircleOff },
                      ].map(({ status, label, description, Icon }) => {
                        const isCurrent = statusMenuClient.paymentStatus === status;
                        const hasBalance = getBalanceDue(statusMenuClient) > 0;
                        const hasPayments = numericAmount(statusMenuClient.amountReceived) > 0;
                        const disabled = status === "Unpaid" ? hasPayments || isCurrent : !hasBalance;
                        return (
                          <div key={status} className={cn("flex items-center gap-3 p-3", disabled && "bg-slate-50/70 opacity-55")}>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-800">
                              <Icon size={17} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-black text-slate-900">{label}</p>
                                {isCurrent && <span className="ui-status-badge bg-slate-100 text-slate-600 border-slate-200">Current</span>}
                              </div>
                              <p className="mt-0.5 text-xs font-medium leading-4 text-slate-500">{description}</p>
                            </div>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                const clientId = statusMenuClient.id;
                                setStatusMenuClient(null);
                                handlePaymentAction(clientId, status);
                              }}
                              className="ui-icon-btn shrink-0 text-blue-800"
                              aria-label={label}
                            >
                              <ArrowRight size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {getBalanceDue(statusMenuClient) <= 0 && (
                      <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 size={16} /> This invoice is fully settled.
                      </div>
                    )}
                  </div>
                </section>
                <section className="border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Payment Journals</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">Each receipt remains as a separate ledger entry.</p>
                    </div>
                    <span className="ui-status-badge bg-white text-slate-600 border-slate-200">
                      {statusMenuClient.paymentHistory?.length || 0} {(statusMenuClient.paymentHistory?.length || 0) === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {statusMenuClient.paymentHistory?.length > 0 ? statusMenuClient.paymentHistory.map((entry, index) => (
                      <div key={entry.id || `${entry.journalNo}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3.5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs font-black text-slate-900">{entry.journalNo || "Legacy entry"}</p>
                            <p className="mt-1 truncate text-xs font-medium text-slate-500">{entry.reference || "No reference"}</p>
                          </div>
                          <p className="shrink-0 font-mono text-sm font-black text-slate-900">{formatMoney(statusMenuClient, entry.amount)}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <span>{entry.bank || entry.method || "Payment"}</span>
                          <span>{entry.date || "Date unavailable"}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center">
                        <ReceiptText className="mx-auto text-slate-400" size={21} />
                        <p className="mt-2 text-sm font-bold text-slate-700">No payment entries yet</p>
                        <p className="mt-1 text-xs text-slate-500">The first verified receipt will appear here.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
            <div className="ui-modal-footer flex justify-end border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
              <button type="button" onClick={() => setStatusMenuClient(null)} className="ui-btn ui-btn-md ui-btn-secondary min-w-28">
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {confirmAction && createPortal(
        <div className="ui-modal-backdrop payment-workspace-backdrop">
          <div className="ui-modal-panel payment-entry-modal motion-pop" role="dialog" aria-modal="true" aria-labelledby="payment-entry-title">
            <div className="ui-modal-header payment-entry-header">
              <div className="payment-entry-heading">
                <div className="payment-entry-heading-icon">
                  <CircleDollarSign size={20} />
                </div>
                <div className="payment-entry-heading-copy">
                  <p className="payment-entry-eyebrow">Payment entry</p>
                  <h3 id="payment-entry-title">
                    {confirmAction.newStatus === "Unpaid" ? "Confirm no payment" : confirmAction.newStatus === "Paid" ? "Pay remaining balance" : "Add part payment"}
                  </h3>
                  <p>{activePaymentClient?.name} <span aria-hidden="true">&middot;</span> Invoice {activePaymentClient?.journalNo}</p>
                </div>
              </div>
              <button type="button" onClick={() => setConfirmAction(null)} className="ui-icon-btn" aria-label="Close payment entry">
                <X size={18} />
              </button>
            </div>
            <div className="ui-modal-body custom-scrollbar payment-entry-scroll">
              {confirmAction.isBlockchainRevision && (
                <div className="payment-revision-notice">
                  <AlertTriangle className="mt-0.5 shrink-0" size={17} />
                  <span>The original blockchain record remains unchanged. This update will be stored as a traceable revision.</span>
                </div>
              )}
              {confirmAction.newStatus !== "Unpaid" ? (
                <>
                  <section className="payment-balance-summary" aria-label="Payment summary">
                    <div className="payment-balance-summary-top">
                      <div>
                        <p className="payment-summary-label">Outstanding balance</p>
                        <p className="payment-balance-amount">{formatMoney(activePaymentClient, activePaymentBalance)}</p>
                      </div>
                      <div className="payment-summary-projected">
                        <span>After payment</span>
                        <PaymentBadge value={projectedPaymentStatus} />
                      </div>
                    </div>
                    <div className="payment-progress-row">
                      <div className="payment-progress-track" aria-label={`${projectedPaymentProgress}% paid after this entry`}>
                        <span className="payment-progress-current" style={{ width: `${activePaymentProgress}%` }} />
                        <span className="payment-progress-added" style={{ left: `${activePaymentProgress}%`, width: `${Math.max(0, projectedPaymentProgress - activePaymentProgress)}%` }} />
                      </div>
                      <span>{projectedPaymentProgress}% paid after entry</span>
                    </div>
                    <dl className="payment-summary-grid">
                      <div>
                        <dt>Invoice total</dt>
                        <dd>{formatMoney(activePaymentClient, activePaymentTotal)}</dd>
                      </div>
                      <div>
                        <dt>Paid to date</dt>
                        <dd>{formatMoney(activePaymentClient, activePaymentReceived)}</dd>
                      </div>
                      <div>
                        <dt>This payment</dt>
                        <dd>{formatMoney(activePaymentClient, activePaymentEntryAmount)}</dd>
                      </div>
                      <div className="payment-summary-balance-after">
                        <dt>Balance after</dt>
                        <dd>{formatMoney(activePaymentClient, projectedPaymentBalance)}</dd>
                      </div>
                    </dl>
                    <div className="payment-journal-rule">
                      <ShieldCheck size={17} />
                      <span><strong>Original journal {activePaymentClient?.journalNo || "-"} stays unchanged.</strong> This receipt will be saved as a separate payment entry.</span>
                    </div>
                  </section>

                  <section className="payment-form-section">
                    <div className="payment-form-heading">
                      <div>
                        <h4>Payment details</h4>
                        <p>Enter the receipt information below. Required fields are marked with an asterisk.</p>
                      </div>
                      <div className="payment-result-preview">
                        <span>After saving</span>
                        <strong>{projectedPaymentStatus}</strong>
                      </div>
                    </div>
                    <div className="payment-form-grid">
                      <label>
                        <span className="payment-field-label">New Payment Journal Number *</span>
                        <input type="text" value={journalInput} onChange={(event) => setJournalInput(event.target.value)} placeholder="e.g. PAY-J-8472-02" autoFocus className="premium-input" />
                      </label>
                      <label>
                        <span className="payment-field-label">{confirmAction.newStatus === "Paid" ? "Payment Amount" : "Part Payment Amount"} *</span>
                        <input type="number" min="1" max={activePaymentBalance} value={paymentForm.amountReceived} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amountReceived: event.target.value }))} className="premium-input payment-amount-input" />
                      </label>
                      <label>
                        <span className="payment-field-label">Payment Date *</span>
                        <input type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentDate: event.target.value }))} className="premium-input" />
                      </label>
                      <label>
                        <span className="payment-field-label">Payment Method *</span>
                        <select
                          value={paymentForm.paymentMethod}
                          onChange={(event) => setPaymentForm((prev) => ({
                            ...prev,
                            paymentMethod: event.target.value,
                            bank: event.target.value === "Bank Transfer" ? prev.bank : "",
                          }))}
                          className="premium-input ui-select"
                        >
                          <option>Bank Transfer</option><option>Cheque</option><option>Cash Deposit</option><option>Digital Payment</option>
                        </select>
                      </label>
                      {paymentForm.paymentMethod === "Bank Transfer" && (
                        <fieldset className="payment-bank-field payment-field-wide">
                          <legend className="payment-field-label">Financial Institution *</legend>
                          <div className="payment-bank-options">
                            {banks.map((bank) => {
                              const selected = paymentForm.bank === bank.name;
                              return (
                                <button
                                  key={bank.name}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => setPaymentForm((prev) => ({ ...prev, bank: bank.name }))}
                                  className={cn("payment-bank-option", selected && "is-selected")}
                                >
                                  <img src={bank.logo} alt="" />
                                  <span>{bank.name}</span>
                                  {selected && <CheckCircle2 className="payment-bank-check" size={15} aria-hidden="true" />}
                                </button>
                              );
                            })}
                          </div>
                          <p className="payment-bank-selection-text">
                            {paymentForm.bank ? `${paymentForm.bank} selected for this payment.` : "Select the receiving bank."}
                          </p>
                        </fieldset>
                      )}
                      <label>
                        <span className="payment-field-label">Payment Sender *</span>
                        <input type="text" value={paymentForm.paymentSender} onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentSender: event.target.value }))} placeholder="Name on the payment" className="premium-input" />
                      </label>
                      <label>
                        <span className="payment-field-label">Payment Reference *</span>
                        <input type="text" value={paymentForm.paymentReference} onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentReference: event.target.value }))} placeholder="Bank or receipt reference" className="premium-input" />
                      </label>
                      <label className="payment-field-wide">
                        <span className="payment-field-label">Verification Note</span>
                        <textarea rows={2} value={paymentForm.verificationRemarks} onChange={(event) => setPaymentForm((prev) => ({ ...prev, verificationRemarks: event.target.value }))} placeholder="Optional note for the audit trail" className="premium-input" />
                      </label>
                      {confirmAction.isBlockchainRevision && (
                        <label className="payment-field-wide">
                          <span className="payment-field-label">Revision Reason *</span>
                          <textarea rows={2} value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder="Explain why this locked record needs a revision" className="premium-input" />
                        </label>
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <div className="mx-auto max-w-xl p-5 sm:p-8">
                  <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
                    <CircleOff className="mt-0.5 shrink-0 text-rose-700" size={18} />
                    <div>
                      <p className="text-sm font-black text-rose-900">Confirm that no payment was received</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-rose-700">This is available only when the invoice has no payment journal entries.</p>
                    </div>
                  </div>
                  <label className="mt-5 block">
                    <span className="payment-field-label">Verification Note</span>
                    <textarea rows={4} value={paymentForm.verificationRemarks} onChange={(event) => setPaymentForm((prev) => ({ ...prev, verificationRemarks: event.target.value }))} placeholder="Add a short review note" className="premium-input mt-2 w-full resize-none px-4 py-3 text-sm outline-none" />
                  </label>
                </div>
              )}
            </div>
            <div className="ui-modal-footer payment-entry-footer">
              <div className="payment-auto-status-note">
                <CheckCircle2 size={16} />
                <span>Status and balance update automatically after saving.</span>
              </div>
              <div className="payment-entry-actions">
                <button type="button" onClick={() => setConfirmAction(null)} className="ui-btn ui-btn-md ui-btn-secondary">Cancel</button>
                <button type="button" onClick={executeAction} className="ui-btn ui-btn-md ui-btn-primary min-w-36">
                  {confirmAction.isBlockchainRevision ? "Submit Revision" : confirmAction.newStatus === "Unpaid" ? "Confirm No Payment" : "Record Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
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
