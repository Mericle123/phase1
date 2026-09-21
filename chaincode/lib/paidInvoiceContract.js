import { Contract } from "fabric-contract-api";

const invoiceKey = (journalNumber) => `PAID_INVOICE_${journalNumber}`;
const correctionKey = (journalNumber, txId) => `CORRECTION_${journalNumber}_${txId}`;

export class PaidInvoiceContract extends Contract {
  async paidInvoiceExists(ctx, journalNumber) {
    this.requireJournalNumber(journalNumber);
    const existing = await ctx.stub.getState(invoiceKey(journalNumber));
    return existing && existing.length > 0;
  }

  async createPaidInvoice(ctx, recordJson) {
    const record = this.parseJson(recordJson, "record");
    this.validatePaidInvoice(record);

    const exists = await this.paidInvoiceExists(ctx, record.journalNumber);
    if (exists) {
      throw new Error(`Paid invoice already exists for journal number ${record.journalNumber}`);
    }

    const txTimestamp = ctx.stub.getTxTimestamp();
    const createdAt = new Date(Number(txTimestamp.seconds) * 1000).toISOString();
    const ledgerRecord = {
      docType: "paidInvoice",
      journalNumber: record.journalNumber,
      invoiceId: record.invoiceId,
      clientNameHash: record.clientNameHash || record.clientCode || "",
      amount: Number(record.amount),
      currency: record.currency,
      paymentStatus: record.paymentStatus,
      verifiedBy: record.verifiedBy,
      verifiedAt: record.verifiedAt,
      paymentReferenceHash: record.paymentReferenceHash,
      createdAt,
      transactionId: ctx.stub.getTxID(),
      corrections: [],
    };

    await ctx.stub.putState(invoiceKey(record.journalNumber), Buffer.from(JSON.stringify(ledgerRecord)));
    return JSON.stringify(ledgerRecord);
  }

  async queryPaidInvoice(ctx, journalNumber) {
    this.requireJournalNumber(journalNumber);
    const bytes = await ctx.stub.getState(invoiceKey(journalNumber));
    if (!bytes || bytes.length === 0) {
      throw new Error(`No paid invoice found for journal number ${journalNumber}`);
    }
    return bytes.toString();
  }

  async createCorrection(ctx, journalNumber, correctionJson) {
    this.requireJournalNumber(journalNumber);
    const correction = this.parseJson(correctionJson, "correction");
    if (!correction.reason || !String(correction.reason).trim()) {
      throw new Error("Correction reason is required");
    }

    const invoice = JSON.parse(await this.queryPaidInvoice(ctx, journalNumber));
    const txTimestamp = ctx.stub.getTxTimestamp();
    const createdAt = new Date(Number(txTimestamp.seconds) * 1000).toISOString();
    const correctionRecord = {
      docType: "invoiceCorrection",
      journalNumber,
      correctionType: correction.correctionType || "Correction",
      reason: correction.reason,
      correctedFields: correction.correctedFields || {},
      createdBy: correction.createdBy || ctx.clientIdentity.getID(),
      createdAt,
      transactionId: ctx.stub.getTxID(),
    };

    invoice.corrections = [...(invoice.corrections || []), correctionRecord.transactionId];
    await ctx.stub.putState(invoiceKey(journalNumber), Buffer.from(JSON.stringify(invoice)));
    await ctx.stub.putState(
      correctionKey(journalNumber, correctionRecord.transactionId),
      Buffer.from(JSON.stringify(correctionRecord)),
    );

    return JSON.stringify(correctionRecord);
  }

  async getHistoryForInvoice(ctx, journalNumber) {
    this.requireJournalNumber(journalNumber);
    const iterator = await ctx.stub.getHistoryForKey(invoiceKey(journalNumber));
    const results = [];
    try {
      for (;;) {
        const item = await iterator.next();
        if (item.value) {
          results.push({
            transactionId: item.value.txId,
            timestamp: item.value.timestamp
              ? new Date(Number(item.value.timestamp.seconds) * 1000).toISOString()
              : "",
            isDelete: item.value.isDelete,
            value: item.value.value?.toString() ? JSON.parse(item.value.value.toString()) : null,
          });
        }
        if (item.done) break;
      }
    } finally {
      await iterator.close();
    }
    return JSON.stringify(results);
  }

  parseJson(value, label) {
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      throw new Error(`Invalid ${label} JSON`);
    }
  }

  requireJournalNumber(journalNumber) {
    if (!journalNumber || !String(journalNumber).trim()) {
      throw new Error("Journal number is required");
    }
  }

  validatePaidInvoice(record) {
    const required = [
      "journalNumber",
      "invoiceId",
      "amount",
      "currency",
      "paymentStatus",
      "verifiedBy",
      "verifiedAt",
      "paymentReferenceHash",
    ];
    const missing = required.filter((field) => record[field] === undefined || record[field] === null || record[field] === "");
    if (missing.length) {
      throw new Error(`Missing paid invoice fields: ${missing.join(", ")}`);
    }
    if (record.paymentStatus !== "Paid") {
      throw new Error("Chaincode accepts only records with paymentStatus Paid");
    }
    if (Number(record.amount) <= 0) {
      throw new Error("Paid amount must be greater than zero");
    }
  }
}
