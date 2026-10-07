import assert from "node:assert/strict";
import test from "node:test";
import { detectInvoiceAnomalies } from "./anomaly-detection.js";

const invoice = (overrides = {}) => ({
  id: "invoice-1",
  clientName: "Northwind Supplies",
  organizationName: "Northwind Supplies",
  journalNo: "J-1001",
  invoiceDate: "2026-08-01",
  invoiceAmount: 1000,
  amountReceived: 0,
  paymentHistory: [],
  paymentStatus: "Unpaid",
  currency: "BTN",
  description: "Monthly office supply delivery",
  ...overrides,
});

const typesOf = (invoices) => detectInvoiceAnomalies(invoices).map((issue) => issue.issueType);

test("ordinary unpaid and partial-payment records are not flagged", () => {
  const unpaid = invoice();
  const partial = invoice({
    id: "invoice-2",
    journalNo: "J-1002",
    invoiceDate: "2026-08-02",
    invoiceAmount: 1200,
    amountReceived: 400,
    paymentStatus: "Partially Paid",
    paymentHistory: [{ journalNo: "PAY-1002", reference: "BANK-1002", amount: 400 }],
  });

  assert.deepEqual(detectInvoiceAnomalies([unpaid, partial]), []);
});

test("same-client same-day same-total invoices are flagged as possible duplicates", () => {
  const first = invoice();
  const second = invoice({ id: "invoice-2", journalNo: "J-1002" });

  assert.equal(typesOf([first, second]).filter((type) => type === "Potential Duplicate Invoice").length, 2);
});

test("reused payment reference across invoices is flagged", () => {
  const first = invoice({
    amountReceived: 250,
    paymentStatus: "Partially Paid",
    paymentHistory: [{ journalNo: "PAY-1", reference: "BANK-REF-12345", amount: 250 }],
  });
  const second = invoice({
    id: "invoice-2",
    clientName: "Another Customer",
    organizationName: "Another Customer",
    journalNo: "J-2001",
    invoiceDate: "2026-08-03",
    amountReceived: 300,
    paymentStatus: "Partially Paid",
    paymentHistory: [{ journalNo: "PAY-2", reference: "bank ref 12345", amount: 300 }],
  });

  assert.equal(typesOf([first, second]).filter((type) => type === "Repeated Payment Reference").length, 2);
});

test("invalid invoice fields and payment inconsistencies are flagged", () => {
  const record = invoice({
    invoiceDate: "2026-02-31",
    invoiceAmount: 100,
    amountReceived: 125,
    paymentStatus: "Partially Paid",
    currency: "XYZ",
    paymentHistory: [{ amount: 80 }],
    lineItems: [
      { quantity: 2, unitPrice: 10, lineTotal: 19 },
      { quantity: 1, unitPrice: 10, lineTotal: 10, description: "" },
    ],
  });
  const types = typesOf([record]);

  assert.ok(types.includes("Invoice Data Validation Warning"));
  assert.ok(types.includes("Payment Exceeds Invoice Total"));
  assert.ok(types.includes("Payment Ledger Mismatch"));
  assert.ok(types.includes("Payment Status Inconsistent"));
  assert.ok(types.includes("Line Item Calculation Mismatch"));
  assert.ok(types.includes("Line Item Description Needs Review"));
});

test("a strong historical amount outlier is flagged only after enough client history", () => {
  const history = Array.from({ length: 5 }, (_, index) => invoice({
    id: `history-${index}`,
    journalNo: `J-H-${index}`,
    invoiceDate: `2026-07-0${index + 1}`,
    invoiceAmount: 100,
  }));
  const outlier = invoice({ id: "outlier", journalNo: "J-OUTLIER", invoiceDate: "2026-08-01", invoiceAmount: 500 });

  assert.ok(typesOf([...history, outlier]).includes("Invoice Amount Outside Historical Pattern"));
  assert.ok(!typesOf(history.slice(0, 4).concat(outlier)).includes("Invoice Amount Outside Historical Pattern"));
});
