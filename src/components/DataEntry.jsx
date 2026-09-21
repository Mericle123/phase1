import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { 
  CheckCircle2, 
  Circle, 
  Lock, 
  X, 
  Save, 
  Download,
  ChevronDown,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  Check,
  CreditCard,
  FileText,
  Image,
  Trash2,
  Upload
} from "lucide-react";
import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { api } from "../services/api";
import { currencyLabel } from "../lib/currency";
import { TaskLoader } from "./TaskLoader";
import BOBLogo from "../assets/BOB.png";
import BDBLLogo from "../assets/BDBL.png";
import BNBLogo from "../assets/BNB.png";
import TBankLogo from "../assets/T-Bank.jpg";
import DigitalKiduLogo from "../assets/DIgital kidu.png";
import NZBritanniaMark from "../assets/nz-britannia-mark.png";

const bankOptions = [
  { name: "Bank of Bhutan", logo: BOBLogo },
  { name: "Bhutan Development Bank", logo: BDBLLogo },
  { name: "Bhutan National Bank", logo: BNBLogo },
  { name: "T-Bank", logo: TBankLogo },
  { name: "Digital Kidu", logo: DigitalKiduLogo },
];

const draftStorageKey = "counttale_invoice_drafts";
const countryNameFormatter = typeof Intl !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const flagForCountry = (countryCode) =>
  String(countryCode || "")
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
const phoneCountryOptions = getCountries()
  .map((code) => ({
    code,
    name: countryNameFormatter?.of(code) || code,
    dialCode: `+${getCountryCallingCode(code)}`,
    flag: flagForCountry(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const createCashFlowPeriods = (count = 5) =>
  Array.from({ length: Math.max(1, Math.min(20, Number.parseInt(count, 10) || 5)) }, (_, index) => ({
    period: index + 1,
    inflow: "",
    outflow: "",
  }));

const statusFromAmounts = (amountReceived, invoiceAmount) => {
  const received = Number.parseFloat(String(amountReceived || "0").replace(/,/g, "")) || 0;
  const total = Number.parseFloat(String(invoiceAmount || "0").replace(/,/g, "")) || 0;
  if (total <= 0 || received <= 0) return "Unpaid";
  if (received < total) return "Partially Paid";
  return "Paid";
};

const PhoneNumberField = ({ country, number, formatted, error, onCountryChange, onNumberChange, onBlur }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = phoneCountryOptions.find((item) => item.code === country) || phoneCountryOptions.find((item) => item.code === "BT");
  const filtered = phoneCountryOptions.filter((item) =>
    `${item.name} ${item.code} ${item.dialCode}`.toLowerCase().includes(query.toLowerCase().trim()),
  );

  return (
    <div className="relative">
      <div className={cn("flex overflow-hidden rounded-lg border premium-input p-0", error && "border-rose-300")}>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="no-motion flex min-h-[3rem] shrink-0 items-center gap-2 border-r border-[var(--ct-line)] px-3 text-sm font-black text-[var(--ct-charcoal)]"
          aria-label="Select phone country"
        >
          <span>{selected?.flag}</span>
          <span>{selected?.dialCode}</span>
          <ChevronDown size={14} />
        </button>
        <input
          type="tel"
          value={number}
          onChange={(event) => onNumberChange(event.target.value.replace(/[^\d\s().-]/g, ""))}
          onBlur={onBlur}
          placeholder="17123456"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-bold text-[var(--ct-charcoal)] outline-none placeholder:text-[var(--ct-muted)]"
        />
      </div>
      {formatted && !error && (
        <p className="mt-1 text-[10px] font-bold text-emerald-700">Formatted: {formatted}</p>
      )}
      {error && <p className="mt-1 text-[10px] font-bold text-rose-600">{error}</p>}
      {open && (
        <>
          <div className="fixed inset-0 z-[210]" onClick={() => setOpen(false)} />
          <div className="premium-popover absolute left-0 right-0 top-full z-[230] mt-2 overflow-hidden rounded-lg">
            <div className="border-b border-[var(--ct-line)] p-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                placeholder="Search country or code..."
                className="premium-input w-full rounded-lg px-3 py-2 text-xs font-bold outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5 custom-scrollbar">
              {filtered.slice(0, 90).map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onCountryChange(item.code);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "no-motion flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[var(--ct-green-50)]",
                    item.code === country && "bg-[var(--ct-green-50)] text-[var(--ct-primary-emerald)]",
                  )}
                >
                  <span className="min-w-0 truncate">{item.flag} {item.name}</span>
                  <span className="shrink-0 text-[var(--ct-muted)]">{item.dialCode}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SectionHeader = ({ number, title }) => (
  <div className="flex items-center gap-4 mb-6">
    <div className="w-9 h-9 bg-[var(--ct-green-900)] text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-emerald-950/10">
      {number}
    </div>
    <h2 className="text-xl font-black text-slate-950 tracking-tight">{title}</h2>
  </div>
);

const InputGroup = ({ label, description, children, className }) => (
  <div className={cn("flex flex-col gap-2", className)}>
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      {description && <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>}
    </div>
    {children}
  </div>
);

const FormInput = ({ value, onChange, onFocus, onBlur, placeholder, prefix, suffix }) => (
  <div className="relative group">
    {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium z-10">{prefix}</span>}
    <input 
      type="text" 
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder} 
      className={cn(
        "premium-input w-full rounded-2xl py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-300 hover:border-slate-300",
        prefix && "pl-9",
        suffix && "pr-9"
      )}
    />
    {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium z-10">{suffix}</span>}
  </div>
);

const FormSelect = ({ value, onChange, onFocus, onBlur, placeholder, options = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeSelect = () => {
    setIsOpen(false);
    onBlur?.();
  };
  
  return (
    <div className={cn("relative group", isOpen ? "z-[210]" : "z-[1]")}>
      <button
        type="button"
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          if (nextOpen) {
            onFocus?.();
          } else {
            onBlur?.();
          }
        }}
        className={cn(
          "premium-input w-full rounded-2xl py-3 px-4 text-sm flex items-center justify-between outline-none transition-all duration-300 hover:border-slate-300 text-left",
          isOpen && "border-blue-400 ring-4 ring-blue-500/10",
          value === "" ? "text-slate-400 font-medium" : "text-slate-900 font-black"
        )}
      >
        <span className="truncate pr-4">{value || placeholder}</span>
        <ChevronDown 
          className={cn("text-slate-400 group-hover:text-slate-900 transition-transform duration-300 flex-shrink-0", isOpen && "rotate-180")} 
          size={16} 
        />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[200]" onClick={closeSelect} />
          <div className="premium-popover absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-[220]">
            <div className="max-h-64 overflow-y-auto p-1.5 custom-scrollbar">
              {options.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-400 text-center font-bold italic">No options available</div>
              ) : (
                options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onChange({ target: { value: opt } });
                      closeSelect();
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 text-sm rounded-xl transition-all flex items-center justify-between group/item",
                      value === opt ? "bg-slate-950 text-white font-black shadow-sm" : "text-slate-600 hover:bg-blue-50 hover:text-slate-950 font-bold"
                    )}
                  >
                    <span className="truncate">{opt}</span>
                    {value === opt && <Check size={14} className="text-white" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const FormTextarea = ({ value, onChange, onFocus, onBlur, placeholder, rows = 3 }) => (
  <textarea 
    value={value}
    onChange={onChange}
    onFocus={onFocus}
    onBlur={onBlur}
    placeholder={placeholder} 
    rows={rows}
    className="premium-input w-full rounded-2xl py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 resize-none"
  />
);


export function DataEntry({ onBack, onAddClient, clients = [] }) {
  const activeDraftId = useRef(null);

  const [formData, setFormData] = useState({
    clientName: "",
    entityType: "",
    citizenship: "",
    country: "Bhutan",
    organizationName: "",
    idCardNumber: "",
    workPassNumber: "",
    zipCode: "",
    companyLogo: "",
    companyLogoName: "",
    companyLogoSource: "",
    phoneCountry: "BT",
    phoneNumber: "",
    phoneFormatted: "",
    passportNumber: "",
    foreignNumber: "",
    journalNo: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    invoiceAmount: "",
    currency: "BTN",
    description: "",
    capitalCost: "",
    amortization: "",
    financingCost: "",
    workingCapital: "",
    pnlRevenue: "",
    pnlCogs: "",
    pnlOpex: "",
    cfOpening: "",
    cfInflow: "",
    cfOutflow: "",
    debtPercent: "",
    equityPercent: "",
    cashFlowAnalysis: "",
    cashFlowProjectName: "",
    analysisPeriod: "5",
    discountRate: "10",
    terminalValue: "",
    sensitivityRevenue: "0",
    sensitivityCosts: "0",
    sensitivityDiscountRate: "0",
    cashFlowPeriods: createCashFlowPeriods(5),
    paymentChoice: "No Payment",
    paymentStatus: "Unpaid",
    bank: "",
    paymentSender: "",
    paymentMethod: "",
    paymentReference: "",
    amountReceived: "",
    paymentEntries: [],
    paymentDate: "",
    verificationRemarks: ""
  });
  const [partPaymentDraft, setPartPaymentDraft] = useState({
    amount: "",
    sender: "",
    method: "Bank Transfer",
    reference: "",
    date: new Date().toISOString().slice(0, 10),
    remarks: "",
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [journalCheck, setJournalCheck] = useState({ status: "idle", message: "" });
  const [phoneError, setPhoneError] = useState("");

  const normalizeCompanyName = (value = "") => String(value).trim().toLowerCase();
  const existingCompanyLogo = useMemo(() => {
    const targetName = normalizeCompanyName(formData.organizationName || formData.clientName);
    if (!targetName) return null;
    return clients.find((client) => {
      if (!client.companyLogo) return false;
      return [client.organizationName, client.clientName, client.name]
        .filter(Boolean)
        .some((name) => normalizeCompanyName(name) === targetName);
    }) || null;
  }, [clients, formData.clientName, formData.organizationName]);

  // Group fields to calculate partial/full progress
  const costsFields = ["capitalCost", "amortization", "financingCost", "workingCapital"];
  const statementFields = ["pnlRevenue", "pnlCogs", "pnlOpex", "cfOpening", "cfInflow", "cfOutflow"];
  const projectionFields = ["debtPercent", "equityPercent", "cashFlowProjectName", "analysisPeriod", "discountRate"];
  // Calculate Progress
  const getProgress = () => {
    const requiredFields = [
      "clientName", "entityType", "citizenship",
      "journalNo", "invoiceDate", "invoiceAmount", "currency",
      "capitalCost", "amortization", "financingCost", "workingCapital",
      "pnlRevenue", "pnlCogs", "pnlOpex",
      "cfOpening", "cfInflow", "cfOutflow",
      "debtPercent", "equityPercent", "cashFlowProjectName", "analysisPeriod", "discountRate"
    ];
    
    if (formData.citizenship === "Bhutanese") {
      // For Bhutanese, we require ID Card OR Passport. Work Pass is now purely optional.
      requiredFields.push("identification"); 
    } else if (formData.citizenship === "Foreigner") {
      requiredFields.push("foreignNumber", "workPassNumber", "zipCode");
    }
    
    const total = requiredFields.length;
    let filled = requiredFields.filter(f => f !== "identification" && formData[f] && formData[f].trim() !== "").length;
    
    if (formData.citizenship === "Bhutanese") {
      const hasId = (formData.idCardNumber.length === 11) || 
                    (formData.passportNumber.trim() !== "");
      if (hasId) filled += 1;
    }

    return total === 0 ? 0 : Math.round((filled / total) * 100);
  };

  const progressPercent = getProgress();

  // Helper to get status of a section
  const getSectionStatus = (fields) => {
    const filled = fields.filter(f => formData[f] && formData[f].trim() !== "").length;
    if (filled === 0) return "empty";
    if (filled === fields.length) return "full";
    return "partial";
  };

  const getBasicStatus = () => {
    const baseFields = ["clientName", "entityType", "citizenship"];
    const baseFilled = baseFields.filter(f => formData[f].trim() !== "").length;
    
    if (baseFilled < 3) return baseFilled === 0 ? "empty" : "partial";
    
    if (formData.citizenship === "Bhutanese") {
      // Work Pass is optional, so we only check ID Card and Passport
      const hasOne = formData.idCardNumber.trim() !== "" || 
                     formData.passportNumber.trim() !== "";
      
      const idCardValid = formData.idCardNumber.trim() === "" || formData.idCardNumber.length === 11;
      
      if (!hasOne) return "partial";
      if (idCardValid) return "full";
      return "partial";
    }
    
    if (formData.citizenship === "Foreigner") {
      return formData.foreignNumber.trim() !== "" &&
        formData.workPassNumber.trim() !== "" &&
        formData.zipCode.trim() !== ""
        ? "full"
        : "partial";
    }
    
    return "partial";
  };

  const basicStatus = getBasicStatus();
  const costsStatus = getSectionStatus(costsFields);
  const statementStatus = getSectionStatus(statementFields);
  const projectionStatus = getSectionStatus(projectionFields);
  const paymentStatus = formData.invoiceAmount ? "full" : "empty";

  const numericValue = (value) => {
    const parsed = Number.parseFloat(String(value || "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sumPartPayments = (entries = formData.paymentEntries) =>
    entries.reduce((sum, entry) => sum + numericValue(entry.amount), 0);

  const getPaymentStatus = (amountReceived = formData.amountReceived, invoiceAmount = formData.invoiceAmount) =>
    statusFromAmounts(amountReceived, invoiceAmount);

  const invoiceTotal = numericValue(formData.invoiceAmount);
  const amountReceived = sumPartPayments() || numericValue(formData.amountReceived);
  const currentPaymentStatus = getPaymentStatus(amountReceived, formData.invoiceAmount);
  const balanceDue = Math.max(0, invoiceTotal - amountReceived);
  const paymentProgressPercent = invoiceTotal > 0 ? Math.min(100, Math.round((amountReceived / invoiceTotal) * 100)) : 0;
  const paymentStatusTone = {
    Paid: "border-emerald-100 bg-emerald-50 text-emerald-700",
    "Partially Paid": "border-amber-100 bg-amber-50 text-amber-700",
    Pending: "border-amber-100 bg-amber-50 text-amber-700",
    Unpaid: "border-rose-100 bg-rose-50 text-rose-700",
  };
  const paymentStatusText = {
    Paid: "Full payment received",
    "Partially Paid": "Part payment received",
    Pending: "Part payment received",
    Unpaid: "No payment received",
  };
  const currencyPrefix = currencyLabel(formData.currency || "BTN");
  const formatMoney = (value) => `${currencyPrefix} ${numericValue(value).toLocaleString()}`;
  const hasMeaningfulDraftData = useMemo(() => {
    const meaningfulFields = [
      "clientName",
      "entityType",
      "citizenship",
      "organizationName",
      "idCardNumber",
      "workPassNumber",
      "zipCode",
      "companyLogo",
      "phoneNumber",
      "passportNumber",
      "foreignNumber",
      "journalNo",
      "invoiceAmount",
      "description",
      "capitalCost",
      "amortization",
      "financingCost",
      "workingCapital",
      "pnlRevenue",
      "pnlCogs",
      "pnlOpex",
      "cfOpening",
      "cfInflow",
      "cfOutflow",
      "debtPercent",
      "equityPercent",
      "cashFlowAnalysis",
      "cashFlowProjectName",
      "terminalValue",
      "paymentSender",
      "paymentMethod",
      "paymentReference",
      "amountReceived",
      "paymentDate",
      "verificationRemarks",
    ];
    return (
      meaningfulFields.some((field) => String(formData[field] ?? "").trim()) ||
      formData.paymentEntries.length > 0 ||
      formData.cashFlowPeriods.some((period) => String(period.inflow || period.outflow || "").trim())
    );
  }, [formData]);
  const previewRows = [
    ["Capital Cost", formData.capitalCost],
    ["Working Capital", formData.workingCapital],
    ["Gross Revenue", formData.pnlRevenue],
  ].filter(([, value]) => numericValue(value) > 0);
  const selectedBank = bankOptions.find((bank) => bank.name === formData.bank);
  const selectedPhoneCountry = phoneCountryOptions.find((item) => item.code === formData.phoneCountry) || phoneCountryOptions.find((item) => item.code === "BT");
  const fullPhoneValue = formData.phoneNumber.trim()
    ? `${selectedPhoneCountry?.dialCode || "+975"}${formData.phoneNumber.replace(/\D/g, "")}`
    : "";
  const sensitivityRevenueFactor = 1 + numericValue(formData.sensitivityRevenue) / 100;
  const sensitivityCostFactor = 1 + numericValue(formData.sensitivityCosts) / 100;
  const adjustedDiscountRate = Math.max(0, numericValue(formData.discountRate) + numericValue(formData.sensitivityDiscountRate));
  const cashFlowRows = formData.cashFlowPeriods.map((row) => {
    const inflow = numericValue(row.inflow) * sensitivityRevenueFactor;
    const outflow = numericValue(row.outflow) * sensitivityCostFactor;
    return {
      ...row,
      adjustedInflow: inflow,
      adjustedOutflow: outflow,
      net: inflow - outflow,
    };
  });
  const initialInvestment = numericValue(formData.capitalCost);
  const terminalValue = numericValue(formData.terminalValue);
  const cashFlowTableRows = cashFlowRows.reduce((rows, row, index) => {
    const netWithTerminal = index === cashFlowRows.length - 1 ? row.net + terminalValue : row.net;
    const previousCumulative = rows[index - 1]?.cumulative ?? -initialInvestment;
    rows.push({
      ...row,
      netWithTerminal,
      cumulative: previousCumulative + netWithTerminal,
    });
    return rows;
  }, []);
  const npv = cashFlowRows.reduce((sum, row, index) => {
    const cashFlow = row.net + (index === cashFlowRows.length - 1 ? terminalValue : 0);
    return sum + cashFlow / ((1 + adjustedDiscountRate / 100) ** (index + 1));
  }, -initialInvestment);
  const calculateIrr = () => {
    const flows = [-initialInvestment, ...cashFlowRows.map((row, index) => row.net + (index === cashFlowRows.length - 1 ? terminalValue : 0))];
    let low = -0.95;
    let high = 2;
    for (let i = 0; i < 80; i += 1) {
      const mid = (low + high) / 2;
      const value = flows.reduce((sum, flow, index) => sum + flow / ((1 + mid) ** index), 0);
      if (value > 0) low = mid;
      else high = mid;
    }
    const irrValue = ((low + high) / 2) * 100;
    return Number.isFinite(irrValue) ? irrValue : 0;
  };
  const irr = initialInvestment > 0 ? calculateIrr() : 0;
  const paybackPeriod = (() => {
    if (initialInvestment <= 0) return "Add investment";
    let cumulative = -initialInvestment;
    for (const row of cashFlowRows) {
      const previous = cumulative;
      cumulative += row.net;
      if (cumulative >= 0) {
        const fraction = row.net > 0 ? Math.max(0, Math.min(1, Math.abs(previous) / row.net)) : 0;
        return `${(row.period - 1 + fraction).toFixed(1)} periods`;
      }
    }
    return "Not recovered";
  })();

  const addPartPayment = () => {
    const amount = numericValue(partPaymentDraft.amount);
    const currentTotal = sumPartPayments();
    if (amount <= 0) {
      toast.error("Payment Amount Required", { description: "Enter a part payment amount greater than zero." });
      return;
    }
    if (invoiceTotal <= 0) {
      toast.error("Invoice Amount Required", { description: "Enter the invoice amount before marking a part payment." });
      return;
    }
    if (currentTotal + amount >= invoiceTotal) {
      toast.error("Part Payment Must Be Partial", {
        description: "Enter an amount lower than the remaining balance so this record stays Partially Paid.",
      });
      return;
    }
    if (!partPaymentDraft.reference.trim()) {
      toast.error("Payment Reference Required", { description: "Add a receipt, bank, or transfer reference." });
      return;
    }
    const nextEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      amount,
      sender: partPaymentDraft.sender.trim() || formData.paymentSender.trim(),
      method: partPaymentDraft.method || formData.paymentMethod || "Bank Transfer",
      reference: partPaymentDraft.reference.trim(),
      date: partPaymentDraft.date || formData.paymentDate || new Date().toISOString().slice(0, 10),
      remarks: partPaymentDraft.remarks.trim(),
    };
    setFormData((prev) => {
      const paymentEntries = [...prev.paymentEntries, nextEntry];
      return {
        ...prev,
        paymentEntries,
        amountReceived: String(sumPartPayments(paymentEntries)),
        paymentSender: prev.paymentSender || nextEntry.sender,
        paymentMethod: prev.paymentMethod || nextEntry.method,
        paymentReference: nextEntry.reference,
        paymentDate: nextEntry.date,
      };
    });
    setPartPaymentDraft((prev) => ({
      ...prev,
      amount: "",
      reference: "",
      remarks: "",
    }));
    setFormData((prev) => ({ ...prev, paymentChoice: "Partial Payment", paymentStatus: "Partially Paid" }));
    toast.success("Part payment marked done", { description: "The record is categorized as Partially Paid." });
  };

  const removePartPayment = (id) => {
    setFormData((prev) => {
      const paymentEntries = prev.paymentEntries.filter((entry) => entry.id !== id);
      return {
        ...prev,
        paymentEntries,
        amountReceived: paymentEntries.length ? String(sumPartPayments(paymentEntries)) : "",
      };
    });
  };

  const applyPaymentChoice = (choice) => {
    if (invoiceTotal <= 0) {
      toast.error("Invoice Amount Required", { description: "Enter the invoice amount before choosing a payment option." });
      return;
    }
    if (choice === "No Payment") {
      setFormData((prev) => ({
        ...prev,
        paymentChoice: choice,
        paymentStatus: "Unpaid",
        amountReceived: "",
        paymentEntries: [],
        paymentReference: "",
        paymentDate: "",
      }));
      return;
    }
    if (choice === "Full Payment") {
      const today = formData.paymentDate || new Date().toISOString().slice(0, 10);
      setFormData((prev) => ({
        ...prev,
        paymentChoice: choice,
        paymentStatus: "Paid",
        amountReceived: String(invoiceTotal),
        paymentEntries: [],
        paymentDate: today,
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      paymentChoice: choice,
      paymentStatus: "Partially Paid",
      amountReceived: prev.amountReceived && numericValue(prev.amountReceived) < invoiceTotal ? prev.amountReceived : "",
      paymentDate: prev.paymentDate || new Date().toISOString().slice(0, 10),
    }));
  };

  const formatPhoneNumber = (countryCode = formData.phoneCountry, rawNumber = formData.phoneNumber) => {
    const country = phoneCountryOptions.find((item) => item.code === countryCode) || selectedPhoneCountry;
    const digits = String(rawNumber || "").replace(/\D/g, "");
    if (!digits) {
      setPhoneError("");
      setFormData((prev) => ({ ...prev, phoneFormatted: "" }));
      return true;
    }
    const internationalValue = `${country?.dialCode || "+975"}${digits}`;
    if (!isValidPhoneNumber(internationalValue)) {
      setPhoneError(`Enter a valid ${country?.name || "international"} phone number.`);
      setFormData((prev) => ({ ...prev, phoneFormatted: internationalValue }));
      return false;
    }
    const parsed = parsePhoneNumberFromString(internationalValue);
    setPhoneError("");
    setFormData((prev) => ({
      ...prev,
      phoneFormatted: parsed?.formatInternational() || internationalValue,
    }));
    return true;
  };

  const updateCashFlowPeriod = (periodIndex, field, value) => {
    setFormData((prev) => ({
      ...prev,
      cashFlowPeriods: prev.cashFlowPeriods.map((row, index) =>
        index === periodIndex ? { ...row, [field]: value.replace(/\D/g, "") } : row,
      ),
    }));
  };

  const checkJournalAvailability = async ({ showToast = false } = {}) => {
    const journalNo = formData.journalNo.trim();
    if (!journalNo) {
      setJournalCheck({ status: "idle", message: "" });
      return false;
    }

    const localDuplicate = clients.some(
      (client) => client.journalNo && client.journalNo.trim().toLowerCase() === journalNo.toLowerCase(),
    );
    if (localDuplicate) {
      const message = `Journal number "${journalNo}" is already assigned to another record.`;
      setJournalCheck({ status: "duplicate", message });
      if (showToast) toast.error("Double Entry Blocked", { description: message });
      return false;
    }

    setJournalCheck({ status: "checking", message: "Checking journal number..." });
    try {
      const result = await api.checkJournal(journalNo);
      if (result.exists) {
        const message = `Journal number "${journalNo}" already exists in the database.`;
        setJournalCheck({ status: "duplicate", message });
        if (showToast) toast.error("Double Entry Blocked", { description: message });
        return false;
      }
      setJournalCheck({ status: "available", message: "Journal number is available." });
      return true;
    } catch (error) {
      setJournalCheck({ status: "error", message: error.message || "Could not verify journal number." });
      if (showToast) toast.error("Journal Check Failed", { description: error.message });
      return false;
    }
  };

  const validateForm = () => {
    if (!formData.clientName.trim()) {
      return { title: "Missing Information", message: "Client Name is required." };
    }
    if (!formData.entityType.trim()) {
      return { title: "Missing Entity Type", message: "Please select the entity type." };
    }
    if (!formData.citizenship.trim()) {
      return { title: "Missing Citizenship", message: "Please select the citizenship status." };
    }
    if (formData.citizenship === "Bhutanese") {
      const hasIdentity = formData.idCardNumber.trim() || formData.passportNumber.trim();
      if (!hasIdentity) {
        return { title: "Missing Identity", message: "Enter an 11-digit CID or a passport number." };
      }
      if (formData.idCardNumber.trim() && formData.idCardNumber.length !== 11) {
        return { title: "Invalid CID", message: "CID must be exactly 11 digits." };
      }
    }
    if (formData.citizenship === "Foreigner") {
      if (!formData.foreignNumber.trim()) {
        return { title: "Missing Foreign ID", message: "Enter the foreign ID or passport number." };
      }
      if (!formData.workPassNumber.trim()) {
        return { title: "Missing Work Pass", message: "Enter the foreign work pass number." };
      }
      if (!formData.zipCode.trim()) {
        return { title: "Missing Zip Code", message: "Enter the foreign zip code." };
      }
    }
    if (!formData.journalNo.trim()) {
      return { title: "Missing Journal Number", message: "A unique journal number is required." };
    }
    if (!formData.invoiceDate.trim()) {
      return { title: "Missing Invoice Date", message: "Invoice date is required." };
    }
    if (numericValue(formData.invoiceAmount) <= 0) {
      return { title: "Missing Invoice Amount", message: "Invoice amount must be greater than zero." };
    }
    if (!formData.currency.trim()) {
      return { title: "Missing Currency", message: "Currency is required." };
    }
    if (formData.phoneNumber.trim() && !formatPhoneNumber()) {
      return { title: "Invalid Phone Number", message: phoneError || "Enter a valid international phone number." };
    }

    const requiredFinancialFields = [
      ["capitalCost", "Capital cost"],
      ["amortization", "Long-term amortization"],
      ["financingCost", "Financing cost"],
      ["workingCapital", "Working capital"],
      ["pnlRevenue", "Gross revenue"],
      ["pnlCogs", "Cost of sales"],
      ["pnlOpex", "Operating expenses"],
      ["cfOpening", "Opening balance"],
      ["cfInflow", "Total inflows"],
      ["cfOutflow", "Total outflows"],
      ["debtPercent", "Debt percentage"],
      ["equityPercent", "Equity percentage"],
      ["cashFlowProjectName", "Project or investment name"],
      ["analysisPeriod", "Analysis period"],
      ["discountRate", "Discount rate"],
    ];
    const missingFinancial = requiredFinancialFields.find(([field]) => !String(formData[field] || "").trim());
    if (missingFinancial) {
      return { title: "Incomplete Financial Data", message: `${missingFinancial[1]} is required.` };
    }
    if (numericValue(formData.debtPercent) + numericValue(formData.equityPercent) !== 100) {
      return { title: "Invalid Capital Structure", message: "Debt and equity percentages must total 100%." };
    }
    return null;
  };

  const getStatusIcon = (status) => {
    return status === "full" ? CheckCircle2 : Circle;
  };

  const getStatusColor = (status) => {
    if (status === "full") return "text-emerald-500 fill-emerald-500/20";
    if (status === "partial") return "text-amber-500 fill-amber-500/20";
    return "text-slate-300";
  };

  const handleFocus = (section) => setActiveSection(section);
  const handleBlur = () => setActiveSection(null);

  const handleInputChange = (field, value) => {
    // Numeric only validation for specific fields
    if (["idCardNumber", "debtPercent", "equityPercent", "pnlRevenue", "pnlCogs", "pnlOpex", "cfOpening", "cfInflow", "cfOutflow", "capitalCost", "invoiceAmount", "amountReceived", "financingCost", "workingCapital", "analysisPeriod", "discountRate", "terminalValue", "sensitivityRevenue", "sensitivityCosts", "sensitivityDiscountRate"].includes(field)) {
      const numericValue = value.replace(/\D/g, "");
      
      // Length limits
      if (field === "idCardNumber" && numericValue.length > 11) return;
      
      // Auto-calculate percentages
      if (field === "debtPercent") {
        const val = Math.min(100, parseInt(numericValue) || 0);
        setFormData(prev => ({ 
          ...prev, 
          debtPercent: val.toString(),
          equityPercent: (100 - val).toString()
        }));
      } else if (field === "equityPercent") {
        const val = Math.min(100, parseInt(numericValue) || 0);
        setFormData(prev => ({ 
          ...prev, 
          equityPercent: val.toString(),
          debtPercent: (100 - val).toString()
        }));
      } else if (field === "analysisPeriod") {
        const periodCount = Math.max(1, Math.min(20, parseInt(numericValue, 10) || 1));
        setFormData(prev => {
          const nextPeriods = createCashFlowPeriods(periodCount).map((row, index) => prev.cashFlowPeriods[index] || row);
          return { ...prev, analysisPeriod: String(periodCount), cashFlowPeriods: nextPeriods };
        });
      } else if (field === "invoiceAmount") {
        setFormData(prev => ({
          ...prev,
          invoiceAmount: numericValue,
          amountReceived: prev.paymentChoice === "Full Payment" ? numericValue : prev.amountReceived,
        }));
      } else {
        setFormData(prev => ({ ...prev, [field]: numericValue }));
      }
    } else if (field === "phoneCountry") {
      setFormData(prev => ({ ...prev, phoneCountry: value, phoneFormatted: "" }));
      setPhoneError("");
    } else if (field === "phoneNumber") {
      setFormData(prev => ({ ...prev, phoneNumber: value, phoneFormatted: "" }));
      setPhoneError("");
    } else if (field === "citizenship") {
      setFormData(prev => ({
        ...prev,
        citizenship: value,
        country: value === "Bhutanese" ? "Bhutan" : prev.country,
        idCardNumber: value === "Bhutanese" ? prev.idCardNumber : "",
        passportNumber: value === "Bhutanese" ? prev.passportNumber : "",
        foreignNumber: value === "Foreigner" ? prev.foreignNumber : "",
        workPassNumber: value === "Foreigner" ? prev.workPassNumber : "",
        zipCode: value === "Foreigner" ? prev.zipCode : "",
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    if (field === "journalNo") {
      const journalNo = value.trim();
      const localDuplicate = clients.some(
        (client) => client.journalNo && client.journalNo.trim().toLowerCase() === journalNo.toLowerCase(),
      );
      setJournalCheck(
        journalNo && localDuplicate
          ? { status: "duplicate", message: `Journal number "${journalNo}" is already assigned to another record.` }
          : { status: "idle", message: "" },
      );
    }
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Unsupported Logo", { description: "Please upload a PNG, JPG, or JPEG image." });
      event.target.value = "";
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("Logo Too Large", { description: "Please choose an image under 1.5 MB." });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({
        ...prev,
        companyLogo: String(reader.result || ""),
        companyLogoName: file.name,
        companyLogoSource: "Uploaded",
      }));
      toast.success("Company logo added");
    };
    reader.onerror = () => toast.error("Logo Upload Failed", { description: "Could not read the selected image." });
    reader.readAsDataURL(file);
  };

  const useExistingLogo = () => {
    if (!existingCompanyLogo?.companyLogo) return;
    setFormData((prev) => ({
      ...prev,
      companyLogo: existingCompanyLogo.companyLogo,
      companyLogoName: existingCompanyLogo.companyLogoName || `${existingCompanyLogo.name || existingCompanyLogo.clientName} logo`,
      companyLogoSource: "Company Profile",
    }));
    toast.success("Existing company logo applied");
  };

  const removeLogo = () => {
    setFormData((prev) => ({
      ...prev,
      companyLogo: "",
      companyLogoName: "",
      companyLogoSource: "",
    }));
  };

  const saveDraft = useCallback(({ auto = false, silent = false } = {}) => {
    if (auto && !hasMeaningfulDraftData) return false;
    try {
      const existingDrafts = JSON.parse(localStorage.getItem(draftStorageKey) || "[]");
      if (!activeDraftId.current) activeDraftId.current = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const draft = {
        id: activeDraftId.current,
        title: formData.clientName || formData.journalNo || "Untitled invoice draft",
        updatedAt: new Date().toISOString(),
        formData,
        autosaved: auto,
      };
      const existingIndex = existingDrafts.findIndex((item) => item.id === draft.id);
      const nextDrafts = existingIndex >= 0
        ? existingDrafts.map((item, index) => (index === existingIndex ? draft : item))
        : [draft, ...existingDrafts];
      localStorage.setItem(draftStorageKey, JSON.stringify(nextDrafts.slice(0, 25)));
      window.dispatchEvent(new CustomEvent("counttale:drafts-updated"));
      if (!silent) {
        toast.success(auto ? "Draft saved before leaving" : "Draft Saved", {
          description: "You can reopen it from the draft icon beside notifications.",
        });
      }
      return true;
    } catch {
      if (!silent) {
        toast.error("Draft Save Failed", {
          description: "The form is still on screen, so your current entry has not been lost.",
        });
      }
      return false;
    }
  }, [formData, hasMeaningfulDraftData]);

  const removeActiveDraft = useCallback(() => {
    if (!activeDraftId.current) return;
    const existingDrafts = JSON.parse(localStorage.getItem(draftStorageKey) || "[]");
    localStorage.setItem(
      draftStorageKey,
      JSON.stringify(existingDrafts.filter((item) => item.id !== activeDraftId.current)),
    );
    activeDraftId.current = null;
    window.dispatchEvent(new CustomEvent("counttale:drafts-updated"));
  }, []);

  const handleSaveDraft = () => saveDraft({ auto: false });

  const handleBackWithDraft = () => {
    saveDraft({ auto: true });
    onBack();
  };

  useEffect(() => {
    if (!hasMeaningfulDraftData || isSaving) return undefined;
    const autosaveTimer = window.setTimeout(() => {
      saveDraft({ auto: true, silent: true });
    }, 900);
    return () => window.clearTimeout(autosaveTimer);
  }, [formData, hasMeaningfulDraftData, isSaving, saveDraft]);

  const escapeInvoiceHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const handleDownloadInvoice = () => {
    const invoiceHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>NZ Britannia Invoice ${escapeInvoiceHtml(formData.journalNo || "Draft")}</title>
  <style>
    body { margin: 0; background: #001a70; font-family: Montserrat, Arial, sans-serif; color: #151923; }
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 32px; background: #001a70; }
    .invoice { width: min(760px, 100%); border-radius: 10px; border: 1px solid rgba(29,123,190,.34); background: #ffffff; box-shadow: 0 34px 100px rgba(0,0,0,.28); overflow: hidden; }
    .bar { height: 8px; display: flex; }
    .bar span:nth-child(1) { width: 45%; background: #001a70; }
    .bar span:nth-child(2) { width: 25%; background: #0a5f4a; }
    .bar span:nth-child(3) { width: 20%; background: #1d7bbe; }
    .bar span:nth-child(4) { width: 10%; background: #e1261b; }
    .body { padding: 34px; }
    .top { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
    .logo { width: 72px; height: 72px; border-radius: 8px; border: 1px solid rgba(0,26,112,.14); background: #fff; display: grid; place-items: center; overflow: hidden; }
    .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
    h1 { margin: 0; font-family: "Playfair Display", Georgia, serif; font-size: 38px; color: #001a70; }
    .meta { text-align: right; font-weight: 800; color: #62706b; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 28px; }
    .box { border: 1px solid rgba(0,26,112,.14); border-radius: 8px; padding: 13px; background: rgba(255,255,255,.62); }
    .label { margin: 0 0 6px; color: #62706b; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
    .value { margin: 0; font-weight: 850; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; border: 1px solid rgba(0,26,112,.14); border-radius: 8px; overflow: hidden; }
    th { background: #f7fbff; color: #62706b; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; text-align: left; padding: 12px; }
    td { padding: 13px 12px; border-top: 1px solid rgba(0,26,112,.1); font-weight: 750; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
    .summary { margin-top: 22px; margin-left: auto; width: min(340px, 100%); border-radius: 8px; background: #001a70; color: white; padding: 16px; }
    .summary div { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.12); }
    .summary div:last-child { border-bottom: 0; color: #ffffff; font-size: 18px; font-weight: 900; }
    .note { margin-top: 24px; color: #62706b; font-size: 12px; line-height: 1.7; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="invoice">
	      <div class="bar"><span></span><span></span><span></span><span></span></div>
      <div class="body">
        <div class="top">
          <div>
	            <div class="logo"><img src="${escapeInvoiceHtml(formData.companyLogo || NZBritanniaMark)}" alt="${formData.companyLogo ? "Company logo" : "NZ Britannia"}" /></div>
            <p class="label" style="margin-top:16px;">Billed To</p>
            <p class="value">${escapeInvoiceHtml(formData.clientName || "Client name")}</p>
            <p style="margin:5px 0 0;color:#62706b;">${escapeInvoiceHtml(formData.organizationName || formData.country || "Organization details")}</p>
          </div>
          <div class="meta">
            <h1>Invoice</h1>
            <p>${escapeInvoiceHtml(formData.journalNo || "Draft")}</p>
          </div>
        </div>
        <div class="grid">
          <div class="box"><p class="label">Issue Date</p><p class="value">${escapeInvoiceHtml(formData.invoiceDate || "-")}</p></div>
          <div class="box"><p class="label">Currency</p><p class="value">${escapeInvoiceHtml(formData.currency || "-")}</p></div>
          <div class="box"><p class="label">Status</p><p class="value">${escapeInvoiceHtml(currentPaymentStatus)}</p></div>
          <div class="box"><p class="label">Payment Date</p><p class="value">${escapeInvoiceHtml(formData.paymentDate || "-")}</p></div>
          <div class="box"><p class="label">Bank</p><p class="value">${escapeInvoiceHtml(formData.bank || "Not selected")}</p></div>
          <div class="box"><p class="label">Phone</p><p class="value">${escapeInvoiceHtml(formData.phoneFormatted || fullPhoneValue || "-")}</p></div>
        </div>
        <table>
          <thead><tr><th>Item</th><th class="right">Amount</th></tr></thead>
          <tbody>
            <tr><td>${escapeInvoiceHtml(formData.description || "Invoice amount")}</td><td class="right">${escapeInvoiceHtml(formatMoney(formData.invoiceAmount))}</td></tr>
            ${previewRows.map(([label, value]) => `<tr><td>${escapeInvoiceHtml(label)}</td><td class="right">${escapeInvoiceHtml(formatMoney(value))}</td></tr>`).join("")}
          </tbody>
        </table>
        <div class="summary">
          <div><span>Total invoice amount</span><strong>${escapeInvoiceHtml(formatMoney(formData.invoiceAmount))}</strong></div>
          <div><span>Amount paid</span><strong>${escapeInvoiceHtml(formatMoney(amountReceived))}</strong></div>
          <div><span>Remaining balance</span><strong>${escapeInvoiceHtml(formatMoney(balanceDue))}</strong></div>
        </div>
	        <p class="note">${escapeInvoiceHtml(formData.verificationRemarks || "Retire better. Payment remarks and invoice notes appear here.")}</p>
      </div>
    </section>
  </main>
</body>
</html>`;
    const blob = new Blob([invoiceHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `NZ_Britannia_Invoice_${(formData.journalNo || "Draft").replace(/[^a-z0-9-]+/gi, "_")}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Invoice Downloaded", { description: "The downloaded invoice uses the same NZ Britannia preview design." });
  };

  const handleSaveRecord = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError.title, { description: validationError.message });
      return;
    }

    setIsSaving(true);
    const journalAvailable = await checkJournalAvailability({ showToast: true });
    if (!journalAvailable) {
      setIsSaving(false);
      return;
    }

    const payload = {
      clientName: formData.clientName,
      clientType: formData.entityType || "Corporate",
      citizenship: formData.citizenship,
      cid: formData.citizenship === "Bhutanese" ? formData.idCardNumber : "",
      passport: formData.citizenship === "Bhutanese" ? formData.passportNumber : formData.foreignNumber,
      country: formData.country,
      workPassNumber: formData.citizenship === "Foreigner" ? formData.workPassNumber : "",
      zipCode: formData.citizenship === "Foreigner" ? formData.zipCode : "",
      companyLogo: formData.companyLogo,
      companyLogoName: formData.companyLogoName,
      companyLogoSource: formData.companyLogoSource,
      phoneCountry: formData.phoneCountry,
      phoneNumber: formData.phoneNumber,
      phoneFormatted: formData.phoneFormatted || fullPhoneValue,
      organizationName: formData.organizationName || formData.clientName,
      journalNo: formData.journalNo,
      invoiceDate: formData.invoiceDate,
      invoiceAmount: formData.invoiceAmount,
      currency: formData.currency,
      description: formData.description,
      paymentStatus: currentPaymentStatus,
      bank: formData.bank,
      paymentSender: formData.paymentSender,
      paymentMethod: formData.paymentMethod,
      paymentReference: formData.paymentReference,
      amountReceived: formData.amountReceived,
      paymentHistory: formData.paymentEntries,
      paymentDate: formData.paymentDate,
      verificationRemarks: formData.verificationRemarks,
      financialData: {
        capitalCost: formData.capitalCost,
        amortization: formData.amortization,
        financingCost: formData.financingCost,
        workingCapital: formData.workingCapital,
        pnlRevenue: formData.pnlRevenue,
        pnlCogs: formData.pnlCogs,
        pnlOpex: formData.pnlOpex,
        cfOpening: formData.cfOpening,
        cfInflow: formData.cfInflow,
        cfOutflow: formData.cfOutflow,
        debtPercent: formData.debtPercent,
        equityPercent: formData.equityPercent,
        cashFlowAnalysis: formData.cashFlowAnalysis,
        cashFlowProjectName: formData.cashFlowProjectName,
        analysisPeriod: formData.analysisPeriod,
        discountRate: formData.discountRate,
        terminalValue: formData.terminalValue,
        sensitivityRevenue: formData.sensitivityRevenue,
        sensitivityCosts: formData.sensitivityCosts,
        sensitivityDiscountRate: formData.sensitivityDiscountRate,
        cashFlowPeriods: formData.cashFlowPeriods,
        npv,
        irr,
        paybackPeriod,
      }
    };


    toast.promise(
      onAddClient(payload).then(() => {
        setIsSaving(false);
        removeActiveDraft();
        onBack();
      }).catch((error) => {
        setIsSaving(false);
        throw error;
      }),
      {
        loading: 'Validating and saving invoice...',
        success: () => {
          return 'Invoice record successfully saved.';
        },
        error: (error) => {
          return error.message || 'Failed to save record.';
        },
      }
    );
  };


  return (
    <div className="invoice-entry-page flex h-full flex-col motion-page">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
        <div className="invoice-workspace mx-auto max-w-[1500px] overflow-hidden p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-4 border-b border-[var(--ct-line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <button
                type="button"
                onClick={handleBackWithDraft}
                className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-400 transition-colors hover:text-slate-900"
              >
                <ArrowLeft size={14} />
                Back to home
              </button>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Create New Invoice</h1>
              <p className="mt-2 text-sm font-medium text-slate-500">Create a clear, accountable record from client identity to payment.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="ui-btn ui-btn-md ui-btn-secondary"
              >
                <FileText size={17} />
                Save Draft
              </button>
              <button
                type="button"
                onClick={handleSaveRecord}
                disabled={isSaving}
                className="ui-btn ui-btn-md ui-btn-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Save size={17} />
                {isSaving ? <TaskLoader type="invoice" compact className="button-inline-loader" /> : "Save Invoice"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 pb-20 lg:grid-cols-12">

          <div className="lg:col-span-8 space-y-8">
            <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                <CheckCircle2 size={12} />
                Active Validation
            </div>

            {/* Section 1: Basic Information */}
            <div className={cn(
              "premium-card relative p-5 sm:p-8 rounded-[1.35rem] transition-all duration-300",
              activeSection === "basic" ? "border-blue-300 shadow-2xl shadow-blue-200/30 z-[180]" : "z-[4]"
            )}>
              <SectionHeader number="1" title="Basic Information" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InputGroup label="Client Name" description="Full legal name of the entity">
                  <FormInput 
                    value={formData.clientName}
                    onChange={(e) => handleInputChange("clientName", e.target.value)}
                    onFocus={() => handleFocus("basic")}
                    onBlur={handleBlur}
                    placeholder="Enter full legal name..." 
                  />
                </InputGroup>
                <InputGroup label="Entity Type" description="Registration category">
                  <FormSelect 
                    value={formData.entityType}
                    onChange={(e) => handleInputChange("entityType", e.target.value)}
                    onFocus={() => handleFocus("basic")}
                    onBlur={handleBlur}
                    placeholder="Select type..." 
                    options={["Corporate", "Foreign Entity"]} 
                  />
                </InputGroup>
                <InputGroup label="Citizenship" description="Citizenship status">
                  <FormSelect 
                    value={formData.citizenship}
                    onChange={(e) => handleInputChange("citizenship", e.target.value)}
                    onFocus={() => handleFocus("basic")}
                    onBlur={handleBlur}
                    placeholder="Select origin..." 
                    options={["Bhutanese", "Foreigner"]} 
                  />
                </InputGroup>
                <InputGroup label="Organization" description="Registered organization name">
                  <FormInput 
                    value={formData.organizationName}
                    onChange={(e) => handleInputChange("organizationName", e.target.value)}
                    onFocus={() => handleFocus("basic")}
                    onBlur={handleBlur}
                    placeholder="Optional organization name..." 
                  />
                </InputGroup>
                <InputGroup label="Country" description="Client country">
                  <FormInput 
                    value={formData.country}
                    onChange={(e) => handleInputChange("country", e.target.value)}
                    onFocus={() => handleFocus("basic")}
                    onBlur={handleBlur}
                    placeholder="Bhutan" 
                  />
                </InputGroup>
                <InputGroup label="Phone Number" description="Search by country, flag, or dial code" className="md:col-span-3">
                  <PhoneNumberField
                    country={formData.phoneCountry}
                    number={formData.phoneNumber}
                    formatted={formData.phoneFormatted}
                    error={phoneError}
                    onCountryChange={(value) => handleInputChange("phoneCountry", value)}
                    onNumberChange={(value) => handleInputChange("phoneNumber", value)}
                    onBlur={() => formatPhoneNumber()}
                  />
                </InputGroup>
                <InputGroup label="Company / Business Logo" description="PNG, JPG, or JPEG" className="md:col-span-3">
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white/65 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner">
                        {formData.companyLogo ? (
                          <img
                            src={formData.companyLogo}
                            alt="Company logo preview"
                            className="h-full w-full object-contain p-2"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-300">
                            <Image size={28} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Logo</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">
                          {formData.companyLogoName || "No logo selected"}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {formData.companyLogo
                            ? `${formData.companyLogoSource || "Uploaded"} logo will appear on reports and invoice views.`
                            : "Add a logo once and reuse it for the same company."}
                        </p>
                        {existingCompanyLogo?.companyLogo && existingCompanyLogo.companyLogo !== formData.companyLogo && (
                          <button
                            type="button"
                            onClick={useExistingLogo}
                            className="mt-3 text-xs font-black text-blue-700 hover:text-slate-950"
                          >
                            Use existing company logo
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        id="company-logo-upload"
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleLogoUpload}
                        className="sr-only"
                      />
                      <label
                        htmlFor="company-logo-upload"
                        className="ui-btn ui-btn-sm ui-btn-secondary cursor-pointer"
                      >
                        <Upload size={14} />
                        {formData.companyLogo ? "Replace" : "Upload"}
                      </label>
                      {formData.companyLogo && (
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="ui-btn ui-btn-sm ui-btn-danger"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </InputGroup>
              </div>

              {formData.citizenship === "Bhutanese" && (
                <div className="mt-6 pt-6 border-t border-slate-100 motion-pop">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-tight">Identity verification required</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputGroup label="ID Card Number" description="11-digit national ID">
                      <FormInput 
                        value={formData.idCardNumber}
                        onChange={(e) => handleInputChange("idCardNumber", e.target.value)}
                        onFocus={() => handleFocus("basic")}
                        onBlur={handleBlur}
                        placeholder="11 digits" 
                      />
                      {formData.idCardNumber && formData.idCardNumber.length < 11 && (
                        <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                          <AlertTriangle size={10} /> Must be 11 digits
                        </p>
                      )}
                    </InputGroup>
                    <InputGroup label="Passport Number" description="Valid travel document">
                      <FormInput 
                        value={formData.passportNumber}
                        onChange={(e) => handleInputChange("passportNumber", e.target.value)}
                        onFocus={() => handleFocus("basic")}
                        onBlur={handleBlur}
                        placeholder="Enter passport number..." 
                      />
                    </InputGroup>
                  </div>
                </div>
              )}

              {formData.citizenship === "Foreigner" && (
                <div className="mt-6 pt-6 border-t border-slate-100 motion-pop">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-tight">Foreign basic information required</p>
                  </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <InputGroup label="ID Number / Passport Number" description="Official identification or travel document number">
                    <FormInput
                      value={formData.foreignNumber}
                      onChange={(e) => handleInputChange("foreignNumber", e.target.value)}
                      onFocus={() => handleFocus("basic")}
                      onBlur={handleBlur}
                      placeholder="Enter ID or Passport number..."
                    />
                  </InputGroup>
                  <InputGroup label="Work Pass Number" description="Valid work authorization">
                    <FormInput
                      value={formData.workPassNumber}
                      onChange={(e) => handleInputChange("workPassNumber", e.target.value)}
                      onFocus={() => handleFocus("basic")}
                      onBlur={handleBlur}
                      placeholder="Enter work pass number..."
                    />
                  </InputGroup>
                  <InputGroup label="Zip Code" description="Foreign address postal code">
                    <FormInput
                      value={formData.zipCode}
                      onChange={(e) => handleInputChange("zipCode", e.target.value)}
                      onFocus={() => handleFocus("basic")}
                      onBlur={handleBlur}
                      placeholder="Enter zip code..."
                    />
                  </InputGroup>
                </div>
                </div>
              )}
            </div>

            {/* Section 2: Capital & Costs */}
            <div className={cn(
              "premium-card relative p-5 sm:p-8 rounded-[1.35rem] transition-all duration-300",
              activeSection === "costs" ? "border-blue-300 shadow-2xl shadow-blue-200/30 z-[180]" : "z-[3]"
            )}>
              <SectionHeader number="2" title="Invoice, Journal & Costs" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                <InputGroup label="Journal Number" description="Unique accounting reference">
                  <FormInput 
                    value={formData.journalNo} 
                    onChange={(e) => handleInputChange("journalNo", e.target.value)} 
                    onFocus={() => handleFocus("costs")} 
                    onBlur={() => {
                      handleBlur();
                      void checkJournalAvailability();
                    }}
                    placeholder="e.g. J-9921" 
                  />
                  {journalCheck.message && (
                    <p className={cn(
                      "text-[10px] font-bold mt-1 flex items-center gap-1",
                      journalCheck.status === "available" ? "text-emerald-600" : journalCheck.status === "checking" ? "text-amber-600" : "text-rose-600",
                    )}>
                      <AlertTriangle size={10} /> {journalCheck.message}
                    </p>
                  )}
                </InputGroup>
                <InputGroup label="Invoice Date" description="Official invoice date">
                  <input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => handleInputChange("invoiceDate", e.target.value)}
                    onFocus={() => handleFocus("costs")}
                    onBlur={handleBlur}
                    className="premium-input w-full rounded-2xl py-3 px-4 text-sm text-slate-900 outline-none transition-all"
                  />
                </InputGroup>
                <InputGroup label="Invoice Amount" description="Amount due on invoice">
                  <FormInput value={formData.invoiceAmount} onChange={(e) => handleInputChange("invoiceAmount", e.target.value)} onFocus={() => handleFocus("costs")} onBlur={handleBlur} placeholder="0.00" prefix={currencyPrefix} />
                </InputGroup>
                <InputGroup label="Currency" description="Invoice currency">
                  <FormSelect value={formData.currency} onChange={(e) => handleInputChange("currency", e.target.value)} onFocus={() => handleFocus("costs")} onBlur={handleBlur} placeholder="Select currency..." options={["BTN", "NZD", "INR", "EUR", "KWD"]} />
                </InputGroup>
                <InputGroup label="Financial Institution" description="Choose the bank/logo for this invoice" className="sm:col-span-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    {bankOptions.map((bank) => {
                      const selected = formData.bank === bank.name;
                      return (
                        <button
                          key={bank.name}
                          type="button"
                          onClick={() => handleInputChange("bank", bank.name)}
                          className={cn(
                            "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-3 text-center text-[10px] font-black text-slate-600 transition-all",
                            selected ? "border-blue-400 ring-4 ring-blue-500/10 text-blue-700 shadow-sm" : "border-slate-100 hover:border-blue-100 hover:bg-blue-50/70",
                          )}
                        >
                          <img src={bank.logo} alt={bank.name} className="h-7 max-w-20 object-contain" />
                          <span>{bank.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </InputGroup>
                <InputGroup label="Description" description="Invoice purpose or reference" className="sm:col-span-2">
                  <FormTextarea value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)} onFocus={() => handleFocus("costs")} onBlur={handleBlur} placeholder="Enter invoice description..." rows={2} />
                </InputGroup>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InputGroup label="Capital Cost" description="Initial investment costs">
                  <FormInput value={formData.capitalCost} onChange={(e) => handleInputChange("capitalCost", e.target.value)} onFocus={() => handleFocus("costs")} onBlur={handleBlur} placeholder="0.00" prefix={currencyPrefix} />
                </InputGroup>
                <InputGroup label="Long-term Amortization" description="Asset depreciation over time">
                  <FormSelect value={formData.amortization} onChange={(e) => handleInputChange("amortization", e.target.value)} onFocus={() => handleFocus("costs")} onBlur={handleBlur} placeholder="Select duration..." options={["5 Years", "10 Years", "20 Years"]} />
                </InputGroup>
                <InputGroup label="Financing Cost" description="Interest and loan costs (%)">
                  <FormInput value={formData.financingCost} onChange={(e) => handleInputChange("financingCost", e.target.value)} onFocus={() => handleFocus("costs")} onBlur={handleBlur} placeholder="4.50" suffix="%" />
                </InputGroup>
                <InputGroup label="Working Capital" description="Operational funding needs">
                  <FormInput value={formData.workingCapital} onChange={(e) => handleInputChange("workingCapital", e.target.value)} onFocus={() => handleFocus("costs")} onBlur={handleBlur} placeholder="Enter amount..." />
                </InputGroup>
              </div>
            </div>


              {/* Section 3: Financial Statements */}
            <div className={cn(
              "premium-card relative p-5 sm:p-8 rounded-[1.35rem] transition-all duration-300",
              activeSection === "statement" ? "border-blue-300 shadow-2xl shadow-blue-200/30 z-[180]" : "z-[2]"
            )}>
              <SectionHeader number="3" title="Financial Statements" />
              
              <div className="space-y-10">
                {/* Profit & Loss Segment */}
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    Profit & Loss Account Breakdown
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <InputGroup label="Gross Revenue" description="Annual income">
                      <FormInput value={formData.pnlRevenue} onChange={(e) => handleInputChange("pnlRevenue", e.target.value)} onFocus={() => handleFocus("statement")} onBlur={handleBlur} placeholder="0.00" prefix={currencyPrefix} />
                    </InputGroup>
                    <InputGroup label="Cost of Sales" description="COGS / Direct Costs">
                      <FormInput value={formData.pnlCogs} onChange={(e) => handleInputChange("pnlCogs", e.target.value)} onFocus={() => handleFocus("statement")} onBlur={handleBlur} placeholder="0.00" prefix={currencyPrefix} />
                    </InputGroup>
                    <InputGroup label="Op. Expenses" description="SG&A / Indirect Costs">
                      <FormInput value={formData.pnlOpex} onChange={(e) => handleInputChange("pnlOpex", e.target.value)} onFocus={() => handleFocus("statement")} onBlur={handleBlur} placeholder="0.00" prefix={currencyPrefix} />
                    </InputGroup>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projected Net Income</p>
                      <p className="text-xl font-black text-emerald-400">
                        {formatMoney(parseFloat(formData.pnlRevenue || 0) - parseFloat(formData.pnlCogs || 0) - parseFloat(formData.pnlOpex || 0))}
                      </p>
                    </div>
                    <CheckCircle2 className="text-emerald-500/20" size={32} />
                  </div>
                </div>

                {/* Cash Flow Segment */}
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                    Cash Flow Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <InputGroup label="Opening Balance" description="Initial cash position">
                      <FormInput value={formData.cfOpening} onChange={(e) => handleInputChange("cfOpening", e.target.value)} onFocus={() => handleFocus("statement")} onBlur={handleBlur} placeholder="0.00" prefix={currencyPrefix} />
                    </InputGroup>
                    <InputGroup label="Total Inflows" description="Net cash receipts">
                      <FormInput value={formData.cfInflow} onChange={(e) => handleInputChange("cfInflow", e.target.value)} onFocus={() => handleFocus("statement")} onBlur={handleBlur} placeholder="0.00" prefix={currencyPrefix} />
                    </InputGroup>
                    <InputGroup label="Total Outflows" description="Net cash payments">
                      <FormInput value={formData.cfOutflow} onChange={(e) => handleInputChange("cfOutflow", e.target.value)} onFocus={() => handleFocus("statement")} onBlur={handleBlur} placeholder="0.00" prefix={currencyPrefix} />
                    </InputGroup>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Projections & Analysis */}
            <div className={cn(
              "premium-card relative p-5 sm:p-8 rounded-[1.35rem] transition-all duration-300",
              activeSection === "projections" ? "border-blue-300 shadow-2xl shadow-blue-200/30 z-[180]" : "z-[1]"
            )}>
              <SectionHeader number="4" title="Cash Flow Analysis" />
              <div className="mb-6 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-green-50)]/70 p-4 text-sm font-semibold leading-6 text-[var(--ct-muted)]">
                This section explains whether a project may be financially attractive. Positive NPV means expected future cash is worth more than the initial investment. A higher IRR means stronger return compared with your discount rate.
              </div>
              <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2">
                <InputGroup label="Project / Investment Name" description="Example: Delivery vehicle purchase or branch expansion">
                  <FormInput value={formData.cashFlowProjectName} onChange={(e) => handleInputChange("cashFlowProjectName", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="e.g. New service vehicle" />
                </InputGroup>
	                <InputGroup label="Analysis Period" description="How many years or periods to test. Example: 5 years">
	                  <FormInput value={formData.analysisPeriod} onChange={(e) => handleInputChange("analysisPeriod", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="5" suffix="yrs" />
	                </InputGroup>
                <InputGroup label="Initial Investment" description="Money paid at the start before future cash comes in. Example: machine purchase cost">
                  <FormInput value={formData.capitalCost} onChange={(e) => handleInputChange("capitalCost", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="0" prefix={currencyPrefix} />
                </InputGroup>
	                <InputGroup label="Capital Structure" description="Automatic debt/equity balance">
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Debt %</label>
                      <FormInput value={formData.debtPercent} onChange={(e) => handleInputChange("debtPercent", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="0" suffix="%" />
                    </div>
                    <div className="h-10 flex items-center text-slate-300 text-xl font-light">/</div>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Equity %</label>
                      <FormInput value={formData.equityPercent} onChange={(e) => handleInputChange("equityPercent", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="0" suffix="%" />
                    </div>
                  </div>
                </InputGroup>
                <InputGroup label="Discount Rate" description="Minimum return expected. Example: 10%">
                  <FormInput value={formData.discountRate} onChange={(e) => handleInputChange("discountRate", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="10" suffix="%" />
                </InputGroup>
                <InputGroup label="Terminal / Residual Value" description="Estimated value left at the end of the period">
                  <FormInput value={formData.terminalValue} onChange={(e) => handleInputChange("terminalValue", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="0" prefix={currencyPrefix} />
                </InputGroup>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Expected Cash Flows</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Enter inflows and outflows for each year or period. Net cash flow updates automatically.</p>
                  </div>
                  <span className="ui-status-badge border-emerald-100 bg-emerald-50 text-emerald-700">
                    {formData.cashFlowPeriods.length} periods
                  </span>
                </div>
                <div className="overflow-hidden rounded-lg border border-[var(--ct-line)]">
                  <div className="grid grid-cols-[0.6fr_1fr_1fr_1fr] gap-3 bg-[var(--ct-ivory)] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--ct-muted)]">
                    <span>Period</span>
                    <span>Cash Inflow</span>
                    <span>Cash Outflow</span>
                    <span>Net Flow</span>
                  </div>
                  {formData.cashFlowPeriods.map((row, index) => {
                    const calculated = cashFlowRows[index];
                    return (
                      <div key={row.period} className="grid grid-cols-[0.6fr_1fr_1fr_1fr] gap-3 border-t border-[var(--ct-line)] px-3 py-3 text-xs">
                        <span className="self-center font-black text-slate-900">Year {row.period}</span>
                        <input value={row.inflow} onChange={(event) => updateCashFlowPeriod(index, "inflow", event.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="Money received" className="premium-input min-w-0 rounded-lg px-3 py-2 outline-none" />
                        <input value={row.outflow} onChange={(event) => updateCashFlowPeriod(index, "outflow", event.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="Money spent" className="premium-input min-w-0 rounded-lg px-3 py-2 outline-none" />
                        <span className={cn("self-center font-mono font-black", calculated.net >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatMoney(calculated.net)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <InputGroup label="Revenue Change" description="Test higher/lower sales. Example: 10 means +10%">
                    <FormInput value={formData.sensitivityRevenue} onChange={(e) => handleInputChange("sensitivityRevenue", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="0" suffix="%" />
                  </InputGroup>
                  <InputGroup label="Cost Change" description="Test higher/lower costs. Example: 5 means +5%">
                    <FormInput value={formData.sensitivityCosts} onChange={(e) => handleInputChange("sensitivityCosts", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="0" suffix="%" />
                  </InputGroup>
                  <InputGroup label="Discount Rate Change" description="Test risk changes. Example: 2 means rate increases by 2%">
                    <FormInput value={formData.sensitivityDiscountRate} onChange={(e) => handleInputChange("sensitivityDiscountRate", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="0" suffix="%" />
                  </InputGroup>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className={cn("rounded-lg border p-4", npv >= 0 ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800")}>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Net Present Value</p>
                    <p className="mt-2 text-2xl font-black">{formatMoney(Math.round(npv))}</p>
                    <p className="mt-2 text-xs font-bold opacity-75">{npv >= 0 ? "Potentially attractive because value is positive." : "Review carefully because value is negative."}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--ct-line)] bg-white/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Rate of Return</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{irr.toFixed(1)}%</p>
                    <p className="mt-2 text-xs font-bold text-slate-500">Higher than the discount rate is generally stronger.</p>
                  </div>
                  <div className="rounded-lg border border-[var(--ct-line)] bg-white/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payback Period</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{paybackPeriod}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500">Shows how long it takes to recover the investment.</p>
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--ct-line)] bg-white/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Cumulative Cash Flow Chart</p>
                    <p className="text-[10px] font-bold text-slate-400">Sensitivity-adjusted</p>
                  </div>
                  <div className="space-y-2">
                    {cashFlowTableRows.map((row) => {
                      const maxAbs = Math.max(1, ...cashFlowTableRows.map((item) => Math.abs(item.cumulative)));
                      const width = Math.max(4, Math.min(100, Math.round((Math.abs(row.cumulative) / maxAbs) * 100)));
                      return (
                        <div key={row.period} className="grid grid-cols-[4.5rem_1fr_7rem] items-center gap-3 text-xs">
                          <span className="font-black text-slate-500">Year {row.period}</span>
                          <div className="h-2 overflow-hidden rounded-full bg-[var(--ct-ivory)]">
                            <div className={cn("h-full rounded-full", row.cumulative >= 0 ? "bg-emerald-600" : "bg-rose-500")} style={{ width: `${width}%` }} />
                          </div>
                          <span className="text-right font-mono font-black text-slate-900">{formatMoney(Math.round(row.cumulative))}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <InputGroup label="Plain-language Result Note" description="Optional note for the administrator or report">
                  <FormTextarea value={formData.cashFlowAnalysis} onChange={(e) => handleInputChange("cashFlowAnalysis", e.target.value)} onFocus={() => handleFocus("projections")} onBlur={handleBlur} placeholder="Example: The project has a positive NPV, but costs should be monitored because payback is slow." />
                </InputGroup>
              </div>
            </div>

            {/* Section 5: Payment Details */}
            <div className={cn(
              "premium-card relative p-5 sm:p-8 rounded-[1.35rem] transition-all duration-300",
              activeSection === "payment" ? "border-blue-300 shadow-2xl shadow-blue-200/30 z-[180]" : "z-[1]"
            )}>
              <SectionHeader number="5" title="Payment Details" />
              <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  ["No Payment", "No money received yet", "Unpaid"],
                  ["Partial Payment", "Record money received now", "Partially Paid"],
                  ["Full Payment", "Invoice is fully settled", "Paid"],
                ].map(([choice, detail, status]) => {
                  const selected = formData.paymentChoice === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => applyPaymentChoice(choice)}
                      className={cn(
                        "rounded-lg border p-4 text-left transition-all",
                        selected ? paymentStatusTone[status] : "border-[var(--ct-line)] bg-white/70 text-slate-700 hover:bg-[var(--ct-green-50)]",
                      )}
                    >
                      <span className="block text-sm font-black">{choice}</span>
                      <span className="mt-1 block text-xs font-semibold opacity-75">{detail}</span>
                    </button>
                  );
                })}
              </div>
              <div className={cn(
                "mb-6 rounded-lg border px-4 py-3 text-sm font-bold",
                paymentStatusTone[currentPaymentStatus],
              )}>
                Current status: {currentPaymentStatus}. {paymentStatusText[currentPaymentStatus]} with {formatMoney(balanceDue)} remaining.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InputGroup label="Payment Method" description="Evidence channel, if known">
                  <FormSelect value={formData.paymentMethod} onChange={(e) => handleInputChange("paymentMethod", e.target.value)} onFocus={() => handleFocus("payment")} onBlur={handleBlur} placeholder="Select method..." options={["Bank Transfer", "Cheque", "Cash Deposit", "Digital Payment"]} />
                </InputGroup>
                <InputGroup label="Payment Sender" description="Sender or payer name">
                  <FormInput value={formData.paymentSender} onChange={(e) => handleInputChange("paymentSender", e.target.value)} onFocus={() => handleFocus("payment")} onBlur={handleBlur} placeholder="Optional until verified..." />
                </InputGroup>
                <InputGroup label="Payment Reference" description="Bank or receipt reference">
                  <FormInput value={formData.paymentReference} onChange={(e) => handleInputChange("paymentReference", e.target.value)} onFocus={() => handleFocus("payment")} onBlur={handleBlur} placeholder="Reference number..." />
                </InputGroup>
                <InputGroup label="Total Amount Received" description={formData.paymentEntries.length ? "Calculated from part payments" : "Manual total if no part payments are listed"}>
                  <FormInput value={formData.amountReceived} onChange={(e) => handleInputChange("amountReceived", e.target.value)} onFocus={() => handleFocus("payment")} onBlur={handleBlur} placeholder="0.00" prefix={currencyPrefix} />
                </InputGroup>
                <InputGroup label="Payment Date" description="Evidence date, if available">
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) => handleInputChange("paymentDate", e.target.value)}
                    onFocus={() => handleFocus("payment")}
                    onBlur={handleBlur}
                    className="premium-input w-full rounded-2xl py-3 px-4 text-sm text-slate-900 outline-none transition-all"
                  />
                </InputGroup>
                {formData.paymentChoice === "Partial Payment" && (
                <div className="sm:col-span-2 rounded-2xl border border-slate-100 bg-white/65 p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-700">Part Payment Records</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">Add each partial receipt separately. The total and payment status update immediately.</p>
                    </div>
                    <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {formData.paymentEntries.length} recorded
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                    <input
                      type="text"
                      value={partPaymentDraft.amount}
                      onChange={(event) => setPartPaymentDraft((prev) => ({ ...prev, amount: event.target.value.replace(/\D/g, "") }))}
                      onFocus={() => handleFocus("payment")}
                      onBlur={handleBlur}
                      placeholder="Amount"
                      className="premium-input rounded-2xl px-4 py-3 text-sm outline-none md:col-span-1"
                    />
                    <input
                      type="text"
                      value={partPaymentDraft.reference}
                      onChange={(event) => setPartPaymentDraft((prev) => ({ ...prev, reference: event.target.value }))}
                      onFocus={() => handleFocus("payment")}
                      onBlur={handleBlur}
                      placeholder="Reference"
                      className="premium-input rounded-2xl px-4 py-3 text-sm outline-none md:col-span-2"
                    />
                    <input
                      type="date"
                      value={partPaymentDraft.date}
                      onChange={(event) => setPartPaymentDraft((prev) => ({ ...prev, date: event.target.value }))}
                      onFocus={() => handleFocus("payment")}
                      onBlur={handleBlur}
                      className="premium-input rounded-2xl px-4 py-3 text-sm outline-none md:col-span-1"
                    />
                    <select
                      value={partPaymentDraft.method}
                      onChange={(event) => setPartPaymentDraft((prev) => ({ ...prev, method: event.target.value }))}
                      onFocus={() => handleFocus("payment")}
                      onBlur={handleBlur}
                      className="premium-input ui-select rounded-2xl px-4 py-3 text-sm outline-none md:col-span-1"
                    >
                      <option>Bank Transfer</option>
                      <option>Cheque</option>
                      <option>Cash Deposit</option>
                      <option>Digital Payment</option>
                    </select>
                    <button type="button" onClick={addPartPayment} className="ui-btn ui-btn-md ui-btn-primary md:col-span-1" title="Mark part payment done">
                      Part Payment Done
                    </button>
                    <input
                      type="text"
                      value={partPaymentDraft.sender}
                      onChange={(event) => setPartPaymentDraft((prev) => ({ ...prev, sender: event.target.value }))}
                      onFocus={() => handleFocus("payment")}
                      onBlur={handleBlur}
                      placeholder="Sender name"
                      className="premium-input rounded-2xl px-4 py-3 text-sm outline-none md:col-span-3"
                    />
                    <input
                      type="text"
                      value={partPaymentDraft.remarks}
                      onChange={(event) => setPartPaymentDraft((prev) => ({ ...prev, remarks: event.target.value }))}
                      onFocus={() => handleFocus("payment")}
                      onBlur={handleBlur}
                      placeholder="Optional note"
                      className="premium-input rounded-2xl px-4 py-3 text-sm outline-none md:col-span-3"
                    />
                  </div>
                  {formData.paymentEntries.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>Reference</span>
                        <span>Amount</span>
                        <span>Action</span>
                      </div>
                      {formData.paymentEntries.map((entry) => (
                        <div key={entry.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-slate-100 px-4 py-3 text-xs">
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-900">{entry.reference}</p>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{entry.date || "No date"} / {entry.method}</p>
                          </div>
                          <p className="font-mono font-black text-slate-900">{formatMoney(entry.amount)}</p>
                          <button type="button" onClick={() => removePartPayment(entry.id)} className="ui-icon-btn" aria-label="Remove part payment">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
                <InputGroup label="Remarks" description="Entry note for the administrator" className="sm:col-span-2">
                  <FormTextarea value={formData.verificationRemarks} onChange={(e) => handleInputChange("verificationRemarks", e.target.value)} onFocus={() => handleFocus("payment")} onBlur={handleBlur} placeholder="Add payment evidence note..." rows={2} />
                </InputGroup>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-4 relative">
            <div className="sticky top-8 space-y-6">
              <div className="invoice-preview-panel premium-card p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
	                  <div>
	                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preview</p>
	                    <h3 className="mt-1 text-sm font-black text-slate-950">Generated Invoice</h3>
	                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleDownloadInvoice} className="ui-icon-btn" title="Download invoice" aria-label="Download invoice">
                      <Download size={15} />
                    </button>
                    <span className={cn("ui-status-badge", paymentStatusTone[currentPaymentStatus])}>
                      {invoiceTotal > 0 ? currentPaymentStatus : "Draft"}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--ct-deep-forest)] p-4">
                  <div className="generated-invoice-preview mx-auto max-w-[23rem] rounded-lg p-5 shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                        <div className="ct-preview-logo flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-[var(--ct-green-950)] text-white">
                          {formData.companyLogo ? (
                            <img src={formData.companyLogo} alt="Company logo preview" className="h-full w-full object-contain bg-white p-1" />
                          ) : (
                          <img src={NZBritanniaMark} alt="NZ Britannia mark" className="h-full w-full object-contain p-1.5" />
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice</p>
                        <p className="mt-1 font-mono text-xs font-black text-slate-900">{formData.journalNo || "Draft"}</p>
                      </div>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-3 text-[10px]">
                      <div>
                        <p className="font-black uppercase tracking-widest text-slate-400">Issue Date</p>
                        <p className="mt-1 font-bold text-slate-800">{formData.invoiceDate || "-"}</p>
                      </div>
                      <div>
                        <p className="font-black uppercase tracking-widest text-slate-400">Currency</p>
                        <p className="mt-1 font-bold text-slate-800">{formData.currency || "-"}</p>
                      </div>
                      <div>
                        <p className="font-black uppercase tracking-widest text-slate-400">Payment</p>
                        <p className="mt-1 font-bold text-slate-800">{currentPaymentStatus}</p>
                      </div>
                    </div>
                    <div className="mt-6 space-y-4 text-xs">
                      <div>
                        <p className="font-black uppercase tracking-widest text-slate-400">Billed To</p>
                        <p className="mt-1 font-black text-slate-950">{formData.clientName || "Client name"}</p>
                        <p className="mt-1 text-slate-500">{formData.organizationName || formData.country || "Organization details"}</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white/70 p-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                          {selectedBank ? (
                            <img src={selectedBank.logo} alt={selectedBank.name} className="max-h-6 max-w-7 object-contain" />
                          ) : (
                            <CreditCard size={16} className="text-slate-300" />
                          )}
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bank</p>
                          <p className="text-[11px] font-black text-slate-700">{formData.bank || "Not selected"}</p>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-100">
                        <div className="grid grid-cols-[1fr_auto] bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>Item</span>
                          <span>Amount</span>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] border-t border-slate-100 px-3 py-2">
                          <span className="font-bold text-slate-700">{formData.description || "Invoice amount"}</span>
                          <span className="font-mono font-black text-slate-900">{formatMoney(formData.invoiceAmount)}</span>
                        </div>
                        {previewRows.map(([label, value]) => (
                          <div key={label} className="grid grid-cols-[1fr_auto] border-t border-slate-100 px-3 py-2 text-[11px]">
                            <span className="font-bold text-slate-500">{label}</span>
                            <span className="font-mono font-bold text-slate-700">{formatMoney(value)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-500">Received</span>
                          <span className="font-mono font-black text-slate-900">{formatMoney(amountReceived)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-500">Balance</span>
                          <span className="font-mono font-black text-slate-900">{formatMoney(balanceDue)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-2">
                          <span className="font-black text-slate-900">Total</span>
                          <span className="font-mono font-black text-slate-950">{formatMoney(formData.invoiceAmount)}</span>
                        </div>
                      </div>
                      <p className="text-[10px] font-medium leading-4 text-slate-400">
                        {formData.verificationRemarks || "Notes and payment remarks will appear here after entry."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={cn(
                "premium-card premium-card-hover rounded-[1.35rem] border p-6",
                paymentStatusTone[currentPaymentStatus],
              )}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Payment Summary</p>
                    <h3 className="mt-2 text-2xl font-black">{invoiceTotal > 0 ? currentPaymentStatus : "Awaiting Amount"}</h3>
                    <p className="mt-1 text-xs font-bold opacity-75">{invoiceTotal > 0 ? paymentStatusText[currentPaymentStatus] : "Enter the invoice amount to activate calculation."}</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                    <CreditCard size={20} />
                  </div>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/70">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      currentPaymentStatus === "Paid" ? "bg-emerald-500" : currentPaymentStatus === "Partially Paid" ? "bg-amber-500" : "bg-rose-500",
                    )}
                    style={{ width: `${paymentProgressPercent}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold">
                  <div className="rounded-xl bg-white/65 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-widest opacity-60">Received</p>
                    <p className="mt-1">{formatMoney(amountReceived)}</p>
                  </div>
                  <div className="rounded-xl bg-white/65 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-widest opacity-60">Balance</p>
                    <p className="mt-1">{formatMoney(balanceDue)}</p>
                  </div>
                </div>
              </div>
              
              {/* Sticky Progress Bar */}
              <div className="premium-card premium-card-hover p-6 rounded-[1.35rem]">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Form Integrity</h3>
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 mb-2">
                  <span>Completion Status</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold",
                    progressPercent === 100 ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
                  )}>
                    {progressPercent}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full mb-6 overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-in-out",
                      progressPercent === 100 ? "bg-emerald-500" : "bg-blue-600"
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <ul className="space-y-4">
                  {[
                    { label: "Basic Info Validated", status: basicStatus, section: "basic" },
                    { label: "Invoice & Costs Entered", status: costsStatus, section: "costs" },
                    { label: "Financial Statements Done", status: statementStatus, section: "statement" },
                    { label: "Projections Complete", status: projectionStatus, section: "projections" },
                    { label: "Payment Details Selected", status: paymentStatus, section: "payment" }
                  ].map((item, idx) => {
                    const Icon = getStatusIcon(item.status);
                    const isActive = activeSection === item.section;
                    return (
                      <li key={idx} className={cn(
                        "flex items-center gap-3 text-xs font-medium transition-all duration-300 p-2 rounded-lg",
                        isActive ? "bg-slate-50 text-slate-900 font-bold translate-x-1" : "text-slate-500"
                      )}>
                        <Icon size={16} className={cn("transition-colors duration-500", getStatusColor(item.status))} />
                        {item.label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Consolidated Security & Action Panel */}
              <div className="premium-dark-panel p-6 rounded-[1.35rem] text-white relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-2 text-emerald-400 mb-4">
                    <ShieldCheck size={18} className="animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Secure Ledger</span>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-3">Submission Protocol</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    All financial data is encrypted and cross-referenced with audited statements. 
                    Unique hash generated for audit trails upon submission.
                  </p>

                  <div className="mt-auto bg-white/5 p-3 rounded-lg border border-white/10 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-300 font-medium leading-tight">
                      Double entries are blocked. Please verify client identity before saving.
                    </p>
                  </div>
                </div>
                
                {/* Background decorative elements */}
                <div className="absolute right-[-20px] top-[-20px] opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
                  <Lock size={140} />
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="invoice-back-fab pointer-events-none fixed bottom-24 left-1/2 z-[190] -translate-x-1/2">
        <button
          type="button"
          onClick={handleBackWithDraft}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-[rgba(0,26,112,0.14)] bg-[var(--ct-paper)]/95 px-4 py-3 text-xs font-black uppercase text-[var(--ct-green-800)] shadow-[0_18px_48px_rgba(0,26,112,0.16)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-[rgba(10,95,74,0.32)] hover:bg-white"
          title="Back and save as draft"
        >
          <ArrowLeft size={15} />
          Back & Save
        </button>
      </div>

      {/* Footer Action Bar */}
      <div className="invoice-footer-actions min-h-20 bg-[var(--ct-paper)]/90 backdrop-blur-2xl border-t border-[var(--ct-line)] px-4 sm:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-[0_-4px_24px_rgba(0,26,112,0.06)]">
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleBackWithDraft}
            className="ui-btn ui-btn-md ui-btn-secondary group w-full sm:w-auto"
          >
            <ArrowLeft size={18} />
            Back & Save Draft
          </button>
          <button 
            onClick={() => {
              setFormData({
                clientName: "", entityType: "", citizenship: "", country: "Bhutan", organizationName: "",
                idCardNumber: "", workPassNumber: "", zipCode: "", companyLogo: "", companyLogoName: "", companyLogoSource: "", phoneCountry: "BT", phoneNumber: "", phoneFormatted: "", passportNumber: "", foreignNumber: "",
                journalNo: "", invoiceDate: new Date().toISOString().slice(0, 10), invoiceAmount: "", currency: "BTN", description: "",
                capitalCost: "", amortization: "", financingCost: "", workingCapital: "",
                pnlRevenue: "", pnlCogs: "", pnlOpex: "", cfOpening: "", cfInflow: "", cfOutflow: "",
                debtPercent: "", equityPercent: "", cashFlowAnalysis: "", cashFlowProjectName: "", analysisPeriod: "5", discountRate: "10", terminalValue: "", sensitivityRevenue: "0", sensitivityCosts: "0", sensitivityDiscountRate: "0", cashFlowPeriods: createCashFlowPeriods(5),
                paymentChoice: "No Payment", paymentStatus: "Unpaid", bank: "", paymentSender: "", paymentMethod: "", paymentReference: "", amountReceived: "", paymentEntries: [], paymentDate: "", verificationRemarks: ""
              });
              setPartPaymentDraft({
                amount: "",
                sender: "",
                method: "Bank Transfer",
                reference: "",
                date: new Date().toISOString().slice(0, 10),
                remarks: "",
              });
              toast.info("Form Cleared");
            }}
            className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors px-4 py-2 w-full sm:w-auto"
          >
            Clear All
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="ui-btn ui-btn-md ui-btn-secondary px-6 w-full sm:w-auto"
          >
            <FileText size={18} />
            Save Draft
          </button>
          <button 
            onClick={handleSaveRecord}
            disabled={isSaving}
            className={cn(
              "ui-btn ui-btn-md ui-btn-primary px-8 disabled:opacity-70 disabled:cursor-not-allowed w-full sm:w-auto",
              progressPercent === 100 ? "shadow-emerald-200 ring-4 ring-emerald-500/10" : "shadow-slate-200"
            )}
          >
            <Save size={18} />
            {isSaving ? <TaskLoader type="invoice" compact className="button-inline-loader" /> : "Save Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
