const supportedCurrencies = new Set(["BTN", "USD", "NZD", "INR", "AUD", "EUR", "KWD"]);

const normalizedText = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const normalizedReference = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const amountValue = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const normalized = String(value ?? "").trim().replace(/,/g, "");
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
};
const isValidDate = (value) => {
  const normalized = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === normalized;
};
const roundAmount = (amount) => Math.round(amount * 100) / 100;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const expectedPaymentStatus = (total, received) => {
  if (received <= 0) return "Unpaid";
  if (received < total) return "Partially Paid";
  return "Paid";
};

const invoiceDescription = (invoice) => normalizedText(invoice.description);

const paymentEntriesFor = (invoice) => {
  if (Array.isArray(invoice.paymentHistory) && invoice.paymentHistory.length) return invoice.paymentHistory;
  if (invoice.paymentReference) {
    return [{
      reference: invoice.paymentReference,
      amount: invoice.amountReceived,
      date: invoice.paymentDate,
    }];
  }
  return [];
};

export const detectInvoiceAnomalies = (invoices = []) => {
  const records = Array.isArray(invoices) ? invoices : [];
  const issues = [];
  const addIssue = (invoice, issueType, unusualReason) => {
    issues.push({ invoiceId: invoice.id, issueType, unusualReason });
  };

  for (const invoice of records) {
    const amount = amountValue(invoice.invoiceAmount);
    const received = amountValue(invoice.amountReceived ?? 0);
    const currency = String(invoice.currency || "").trim().toUpperCase();
    const problems = [];

    if (!String(invoice.clientName || "").trim()) problems.push("client name is missing");
    if (!String(invoice.journalNo || "").trim()) problems.push("journal number is missing");
    if (!isValidDate(invoice.invoiceDate)) problems.push("invoice date is missing or invalid");
    if (!Number.isFinite(amount) || amount <= 0) problems.push("invoice total is not a valid positive amount");
    if (!supportedCurrencies.has(currency)) problems.push("currency is missing or unsupported");
    if (problems.length) {
      addIssue(invoice, "Invoice Data Validation Warning", `Review the saved record: ${problems.join("; ")}.`);
    }

    if (Number.isFinite(amount) && Number.isFinite(received) && received > amount + 0.01) {
      addIssue(invoice, "Payment Exceeds Invoice Total", `Recorded payments total ${received.toLocaleString()} ${currency}, exceeding the invoice total of ${amount.toLocaleString()} ${currency}.`);
    }

    const history = Array.isArray(invoice.paymentHistory) ? invoice.paymentHistory : [];
    if (history.length && Number.isFinite(received)) {
      const historyTotal = history.reduce((sum, payment) => sum + (amountValue(payment.amount ?? payment.amountReceived) || 0), 0);
      if (Math.abs(historyTotal - received) > 0.01) {
        addIssue(invoice, "Payment Ledger Mismatch", `Payment entries sum to ${historyTotal.toLocaleString()} ${currency}, but the invoice records ${received.toLocaleString()} ${currency} received.`);
      }
    }

    if (Number.isFinite(amount) && amount > 0 && Number.isFinite(received) && invoice.paymentStatus) {
      const expected = expectedPaymentStatus(amount, received);
      if (invoice.paymentStatus !== expected) {
        addIssue(invoice, "Payment Status Inconsistent", `The recorded amounts imply ${expected}, but the saved status is ${invoice.paymentStatus}.`);
      }
    }

    const description = invoiceDescription(invoice);
    if (description && ["test", "asdf", "n/a", "na", "tbd", "same", "invoice", "misc"].includes(description)) {
      addIssue(invoice, "Generic Invoice Description", "The description looks like a placeholder; check that it explains the transaction.");
    }

    const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : Array.isArray(invoice.items) ? invoice.items : [];
    lineItems.forEach((item, index) => {
      const description = normalizedText(item.description || item.name || item.title);
      if (!description || ["item", "service", "misc", "n/a", "tbd", "test"].includes(description)) {
        addIssue(invoice, "Line Item Description Needs Review", `Line item ${index + 1} has a blank or placeholder description.`);
      }
      const quantity = amountValue(item.quantity ?? item.qty);
      const unitPrice = amountValue(item.unitPrice ?? item.rate ?? item.price);
      const lineTotal = amountValue(item.lineTotal ?? item.amount ?? item.total);
      if (![quantity, unitPrice, lineTotal].every(Number.isFinite) || quantity <= 0 || unitPrice < 0 || lineTotal < 0) {
        addIssue(invoice, "Line Item Calculation Mismatch", `Line item ${index + 1} has a missing, invalid, or negative quantity/price/total.`);
      } else if (Math.abs(quantity * unitPrice - lineTotal) > 0.02) {
        addIssue(invoice, "Line Item Calculation Mismatch", `Line item ${index + 1} does not equal quantity multiplied by unit price.`);
      }
    });
  }

  const invoiceGroups = new Map();
  for (const invoice of records) {
    const client = normalizedText(invoice.organizationName || invoice.clientName);
    const currency = String(invoice.currency || "").toUpperCase();
    const amount = amountValue(invoice.invoiceAmount);
    const date = String(invoice.invoiceDate || "").slice(0, 10);
    if (!client || !date || !Number.isFinite(amount) || amount <= 0) continue;
    const key = [client, date, currency, roundAmount(amount)].join("|");
    const group = invoiceGroups.get(key) || [];
    group.push(invoice);
    invoiceGroups.set(key, group);
  }
  for (const matches of invoiceGroups.values()) {
    if (matches.length < 2) continue;
    for (const invoice of matches) {
      const others = matches.filter((match) => match.id !== invoice.id);
      const references = others.map((match) => match.journalNo).filter(Boolean).join(", ");
      addIssue(invoice, "Potential Duplicate Invoice", `Same client, date, currency, and total also appear on ${references || "another invoice"}; verify the source documents before taking action.`);
    }
  }

  const paymentReferences = new Map();
  for (const invoice of records) {
    const currency = String(invoice.currency || "").toUpperCase();
    for (const payment of paymentEntriesFor(invoice)) {
      const reference = normalizedReference(payment.reference || payment.paymentReference);
      if (reference.length < 5) continue;
      const key = `${reference}|${currency}`;
      const group = paymentReferences.get(key) || [];
      group.push({ invoice, payment });
      paymentReferences.set(key, group);
    }
  }
  for (const matches of paymentReferences.values()) {
    const distinctInvoices = new Set(matches.map(({ invoice }) => invoice.id));
    if (distinctInvoices.size < 2) continue;
    for (const invoice of [...new Map(matches.map(({ invoice }) => [invoice.id, invoice])).values()]) {
      const otherJournals = [...new Set(matches.filter((match) => match.invoice.id !== invoice.id).map((match) => match.invoice.journalNo).filter(Boolean))];
      addIssue(invoice, "Repeated Payment Reference", `The same payment reference appears on another invoice${otherJournals.length ? ` (${otherJournals.join(", ")})` : ""}. Verify the bank transaction and amounts.`);
    }
  }

  const clientHistory = new Map();
  const datedInvoices = [...records].sort((a, b) => new Date(a.invoiceDate || 0) - new Date(b.invoiceDate || 0));
  for (const invoice of datedInvoices) {
    const key = `${normalizedText(invoice.organizationName || invoice.clientName)}|${String(invoice.currency || "").toUpperCase()}`;
    const amount = amountValue(invoice.invoiceAmount);
    if (isValidDate(invoice.invoiceDate) && !key.startsWith("|") && Number.isFinite(amount) && amount > 0) {
      const history = clientHistory.get(key) || [];
      if (history.length >= 5) {
        const baseline = median(history);
        const deviations = history.map((value) => Math.abs(value - baseline));
        const mad = median(deviations);
        const anomalous = mad > 0
          ? Math.abs(0.6745 * (amount - baseline) / mad) > 3.5
          : amount > baseline * 3 || amount < baseline / 3;
        if (anomalous) {
          addIssue(invoice, "Invoice Amount Outside Historical Pattern", `This total (${amount.toLocaleString()} ${invoice.currency}) differs substantially from this client's prior same-currency median of ${baseline.toLocaleString()} ${invoice.currency}; review the source invoice.`);
        }
      }
      clientHistory.set(key, [...(clientHistory.get(key) || []), amount]);
    }
  }

  return issues;
};
