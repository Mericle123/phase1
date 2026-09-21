import crypto from "node:crypto";
import { createLedgerRecord, getLedgerHistory, getLedgerRecord } from "./store.js";

const hash = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

const shortHash = (value) => hash(value).slice(0, 18);

const makeTxId = (journalNumber) => {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `FABRIC-${journalNumber}-${stamp}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
};

export const buildPaidInvoiceRecord = (invoice, actor) => ({
  journalNumber: invoice.journalNo,
  invoiceId: invoice.id,
  clientNameHash: shortHash(`${invoice.clientName}:${invoice.country}:${invoice.id}`),
  amount: invoice.amountReceived || invoice.invoiceAmount,
  currency: invoice.currency,
  paymentStatus: invoice.paymentStatus,
  verifiedBy: actor.id,
  verifiedAt: invoice.verifiedAt || new Date().toISOString(),
  paymentReferenceHash: hash(invoice.paymentReference),
  createdAt: new Date().toISOString(),
  transactionId: makeTxId(invoice.journalNo),
  blockNumber: Math.floor(Date.now() / 1000),
  corrections: [],
  response: "Committed",
});

export const commitPaidInvoice = async (invoice, actor) => {
  if (!invoice?.journalNo) {
    const error = new Error("Journal number is required before blockchain commitment.");
    error.status = 400;
    throw error;
  }
  if (invoice.paymentStatus !== "Paid") {
    const error = new Error("Only verified Paid invoices can be committed to Fabric.");
    error.status = 400;
    throw error;
  }

  const existing = getLedgerRecord(invoice.journalNo);
  if (existing) {
    return { ...existing, alreadyCommitted: true };
  }

  const record = buildPaidInvoiceRecord(invoice, actor);
  await createLedgerRecord(record, actor);
  return record;
};

export const queryPaidInvoice = (journalNumber) => {
  const record = getLedgerRecord(journalNumber);
  if (!record) return null;
  return {
    record,
    history: getLedgerHistory(journalNumber),
  };
};

export const fabricMode = () => ({
  mode: process.env.FABRIC_GATEWAY_ENABLED === "true" ? "fabric-gateway" : "local-dev-ledger",
  note:
    process.env.FABRIC_GATEWAY_ENABLED === "true"
      ? "Backend is configured for Fabric Gateway integration."
      : "Local development ledger is active. Chaincode is included under /chaincode for Fabric deployment.",
});
