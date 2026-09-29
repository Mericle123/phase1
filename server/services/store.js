import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { roleLabels, rolePermissions, seedInvoices, seedUsers } from "../data/seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, "../data/app-db.json");

let db;

const now = () => new Date().toISOString();
const activeWindowMs = 15 * 60 * 1000;
const inactiveWindowMs = 7 * 24 * 60 * 60 * 1000;
const checkInStartMinutes = 9 * 60;
const checkInGraceEndMinutes = 9 * 60 + 30;

const roleDepartments = {
  employee: "Data Entry",
  verifier: "Payment Verification",
  admin: "Administration",
  super_admin: "Administration",
};

const managedRoles = ["employee", "verifier", "admin"];
const adminRoles = ["admin", "super_admin"];
const maxActiveAdmins = 5;
const superAdminProfile = {
  id: "u-admin",
  name: "NG",
  email: "ngawangg927@gmail.com",
  designation: "Super Admin",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=NG&backgroundColor=e2e8f0",
};
const verifierProfile = {
  id: "u-verifier",
  name: "Sonam Wangmo",
  email: "verifier@counttale.bt",
  designation: "Payment Verification Officer",
  phone: "+975 17660022",
  location: "Thimphu, Bhutan",
  workId: "CT-105-VER",
  joined: "April 2025",
  active: true,
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=SonamWangmo&backgroundColor=e2e8f0",
};

const demoIdentityRebrand = new Map([
  ["admin@fintrack.bt", { email: "admin@counttale.bt", workId: "CT-993-ADM" }],
  ["employee@fintrack.bt", { email: "employee@counttale.bt", workId: "CT-104-EMP" }],
]);

const actionLabels = {
  LOGIN_SUCCESS: "Logged in",
  SESSION_ACTIVE: "Session active",
  LOGOUT: "Logged out",
  INVOICE_CREATED: "Submitted invoice entry",
  INVOICE_UPDATED: "Updated invoice record",
  PAYMENT_STATUS_UPDATED: "Updated payment status",
  PAYMENT_VERIFIED: "Verified payment record",
  BLOCKCHAIN_COMMITTED: "Submitted blockchain commit",
  CORRECTION_CREATED: "Submitted correction record",
  BLOCKCHAIN_REVISION_CREATED: "Submitted blockchain revision",
  USER_UPDATED: "Updated user access",
  ADMIN_REVIEW_UPDATED: "Updated admin review",
  DOCUMENT_AUDIT_UPDATED: "Updated document audit",
  USER_CREATED: "Created user account",
  USER_DELETED: "Deleted user account",
  PASSWORD_CHANGED: "Changed own password",
  PASSWORD_REVIEW_KEPT: "Kept current password",
  NOTIFICATION_SENT: "Sent notification",
  NOTIFICATION_READ: "Read notification",
  NOTIFICATION_REPLIED: "Replied to notification",
  TIMING_EXCEPTION_APPROVED: "Approved timing exception",
  TIMING_EXCEPTION_REMOVED: "Removed timing exception",
};

const reviewStatuses = ["Pending Review", "Approved", "Rejected", "Verified", "Flagged"];

const toAmount = (value) => {
  if (typeof value === "number") return value;
  const normalized = String(value || "0").replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculatePaymentStatus = (invoiceAmount, amountReceived) => {
  const total = toAmount(invoiceAmount);
  const received = toAmount(amountReceived);
  if (received <= 0) return "Unpaid";
  if (total > 0 && received < total) return "Partially Paid";
  return "Paid";
};

const normalizePaymentEntries = (entries = []) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      id: entry.id || uuidv4(),
      journalNo: String(entry.journalNo || entry.paymentJournalNo || "").trim(),
      amount: toAmount(entry.amount ?? entry.amountReceived),
      sender: entry.sender || entry.paymentSender || "",
      method: entry.method || entry.paymentMethod || "",
      bank: entry.bank || "",
      reference: entry.reference || entry.paymentReference || "",
      date: entry.date || entry.paymentDate || "",
      remarks: entry.remarks || entry.verificationRemarks || "",
      recordedAt: entry.recordedAt || now(),
      recordedBy: entry.recordedBy || "",
      recordedByName: entry.recordedByName || "",
    }))
    .filter((entry) => entry.amount > 0);

const sumPaymentEntries = (entries = []) =>
  normalizePaymentEntries(entries).reduce((sum, entry) => sum + entry.amount, 0);

const buildPaymentEntry = (payload, actor) => ({
  id: uuidv4(),
  journalNo: String(payload.journalNo || payload.paymentJournalNo || "").trim(),
  amount: toAmount(payload.amount ?? payload.amountReceived),
  sender: payload.sender || payload.paymentSender || "",
  method: payload.method || payload.paymentMethod || "",
  bank: payload.bank || "",
  reference: payload.reference || payload.paymentReference || "",
  date: payload.date || payload.paymentDate || "",
  remarks: payload.remarks || payload.verificationRemarks || "",
  recordedAt: payload.recordedAt || now(),
  recordedBy: actor?.id || "",
  recordedByName: actor?.name || "",
});

const initialsFor = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "CL";

const colorClasses = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
];

const sanitizeUser = (user) => {
  if (!user) return null;
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  delete safeUser.password;
  return {
    ...safeUser,
    roleLabel: roleLabels[user.role] || user.role,
    permissions: rolePermissions[user.role] || [],
  };
};

const getDepartment = (role) => roleDepartments[role] || "General";

const normalizeIp = (ip = "") => String(ip).replace("::ffff:", "").replace("::1", "127.0.0.1");

const isPrivateIp = (ip = "") => {
  const value = normalizeIp(ip);
  return (
    value === "127.0.0.1" ||
    value === "localhost" ||
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value)
  );
};

const getOfficeStatus = (context = {}) => {
  const ip = normalizeIp(context.ipAddress || "");
  const allowed = String(process.env.OFFICE_IP_ALLOWLIST || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!ip) return "Unknown";
  if (allowed.includes(ip) || isPrivateIp(ip)) return "In Office";
  if (context.locationPermission === "granted") return "Location Permission Enabled";
  return "Remote / Unverified";
};

const getDeviceFingerprint = (userAgent = "") => Buffer.from(String(userAgent || "unknown")).toString("base64").slice(0, 18);

const getSession = (context = {}) => {
  if (!context.sessionId) return null;
  return db.sessions.find((session) => session.id === context.sessionId) || null;
};

const getDeviceStatus = (actor, context = {}) => {
  const session = getSession(context);
  if (!session) return "No Active Session";
  if (session.userId !== actor?.id) return "Session Mismatch";
  if (session.deviceFingerprint !== getDeviceFingerprint(context.userAgent)) return "Device Changed";
  return "Trusted Session";
};

const getUserLastSeen = (userId) => {
  const sessionLastSeen = db.sessions
    .filter((session) => session.userId === userId)
    .map((session) => session.lastSeen)
    .filter(Boolean)
    .sort()
    .at(-1);
  const activityLastSeen = db.activityLogs
    .filter((activity) => activity.employeeId === userId)
    .map((activity) => activity.createdAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  return sessionLastSeen || activityLastSeen || "";
};

const getActiveStatus = (userId) => {
  const user = findUserById(userId);
  if (!user?.active) return "Inactive";
  const lastSeen = getUserLastSeen(userId);
  if (!lastSeen) return "Inactive";
  return Date.now() - new Date(lastSeen).getTime() <= activeWindowMs ? "Active" : "Inactive";
};

const buildActivityRecord = ({ actor, action, entityId = "", status = "Completed", remarks = "", context = {}, createdAt = now() }) => {
  const role = actor?.role || "system";
  const officeStatus = getOfficeStatus(context);
  const deviceSessionStatus = getDeviceStatus(actor, context);
  return {
    id: uuidv4(),
    employeeId: actor?.id || "system",
    employeeName: actor?.name || "System",
    role,
    roleLabel: roleLabels[role] || role,
    department: getDepartment(role),
    action,
    actionPerformed: actionLabels[action] || action,
    activityType: action.includes("PAYMENT") || action.includes("VERIFIED")
      ? "Payment"
      : action.includes("INVOICE")
        ? "Invoice"
        : action.includes("LOGIN") || action.includes("SESSION")
          ? "Session"
      : action.includes("BLOCKCHAIN")
        ? "Blockchain"
        : action.includes("AUDIT")
          ? "Audit"
          : "Administration",
    recordId: entityId || "",
    entryTime: createdAt,
    officeStatus,
    deviceSessionStatus,
    activeStatus: actor?.id ? getActiveStatus(actor.id) : "Inactive",
    lastSeen: actor?.id ? getUserLastSeen(actor.id) || createdAt : createdAt,
    status,
    remarks,
    ipAddress: normalizeIp(context.ipAddress || ""),
    userAgent: context.userAgent || "",
    sessionId: context.sessionId || "",
    createdAt,
  };
};

const getInvoiceDuplicateWarning = (invoice) => {
  const sameJournal = db?.invoices?.filter(
    (item) => item.journalNo && item.journalNo.toLowerCase() === String(invoice.journalNo || "").toLowerCase(),
  ) || [];
  return sameJournal.length > 1 ? "Duplicate journal detected" : "Clear";
};

const getInvoiceEntryActivity = (invoiceId) =>
  db?.activityLogs?.find((activity) => activity.recordId === invoiceId && activity.action === "INVOICE_CREATED") || null;

const getInvoiceRevisions = (invoiceId) =>
  (db?.corrections || [])
    .filter((entry) => entry.invoiceId === invoiceId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

const isBlockchainLocked = (invoice) => Boolean(invoice?.blockchain?.transactionId);

const getRevisionReason = (payload = {}) =>
  String(payload.revisionReason || payload.correctionReason || payload.updateReason || payload.reason || "").trim();

const assertRevisionApproval = (payload = {}) => {
  if (!payload.confirmBlockchainRevision) {
    const error = new Error(
      "This verified record is locked because it has already been stored on the blockchain. Confirm that the update should be submitted as a new revision.",
    );
    error.status = 409;
    throw error;
  }
  const reason = getRevisionReason(payload);
  if (!reason) {
    const error = new Error("A revision reason is required for updates to blockchain-confirmed records.");
    error.status = 400;
    throw error;
  }
  return reason;
};

const buildFieldChanges = (current = {}, payload = {}, fields = []) =>
  fields
    .filter((field) => Object.prototype.hasOwnProperty.call(payload, field))
    .map((field) => ({
      field,
      from: current[field] ?? "",
      to: field === "invoiceAmount" || field === "amountReceived" ? toAmount(payload[field]) : payload[field],
    }))
    .filter((change) => JSON.stringify(change.from ?? "") !== JSON.stringify(change.to ?? ""));

const getUserSummary = (userId) => {
  const user = db?.users?.find((item) => item.id === userId);
  if (!user) {
    return {
      id: userId || "",
      name: "Unknown Employee",
      role: "employee",
      roleLabel: roleLabels.employee,
      department: getDepartment("employee"),
      activeStatus: "Inactive",
      lastSeen: "",
    };
  }
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    roleLabel: roleLabels[user.role] || user.role,
    department: getDepartment(user.role),
    activeStatus: getActiveStatus(user.id),
    lastSeen: getUserLastSeen(user.id),
  };
};

const decorateInvoice = (invoice) => {
  const paymentHistory = normalizePaymentEntries(invoice.paymentHistory);
  const amountReceived = paymentHistory.length ? sumPaymentEntries(paymentHistory) : toAmount(invoice.amountReceived);
  const paymentStatus = calculatePaymentStatus(invoice.invoiceAmount, amountReceived);
  const submittedBy = getUserSummary(invoice.enteredBy);
  const verifiedBy = invoice.verifiedBy ? getUserSummary(invoice.verifiedBy) : null;
  const reviewedBy = invoice.reviewedBy ? getUserSummary(invoice.reviewedBy) : null;
  const updatedBy = invoice.updatedBy ? getUserSummary(invoice.updatedBy) : reviewedBy || verifiedBy || submittedBy;
  const entryActivity = getInvoiceEntryActivity(invoice.id);
  const adminReviewStatus = invoice.adminReviewStatus || "Pending Review";
  const revisions = getInvoiceRevisions(invoice.id);
  const latestRevision = revisions.at(-1) || null;
  const locked = isBlockchainLocked(invoice);
  const approvedBy =
    reviewedBy && ["Approved", "Verified"].includes(adminReviewStatus)
      ? reviewedBy
      : null;
  return {
    ...invoice,
    corrections: invoice.corrections || revisions,
    revisionHistory: revisions,
    revisionCount: revisions.length,
    latestRevisionStatus: latestRevision?.status || (locked ? "No Revisions" : "Not Required"),
    latestRevisionAt: latestRevision?.createdAt || "",
    latestRevisionBy: latestRevision?.createdByName || "",
    isBlockchainLocked: locked,
    lockStatus: locked ? "Locked" : "Editable",
    recordLockStatus: locked ? "Locked" : "Editable",
    tamperProtectionStatus: locked ? "Tamper-Protected" : "Standard",
    paymentVerificationStatus: locked || paymentStatus === "Paid" ? "Verified" : paymentStatus,
    originalBlockchainTransactionHash: invoice.blockchain?.transactionId || "",
    name: invoice.clientName,
    type: invoice.clientType,
    category: invoice.citizenship,
    amount: toAmount(invoice.invoiceAmount).toLocaleString("en-US"),
    initials: invoice.initials || initialsFor(invoice.clientName),
    color: invoice.color || colorClasses[Math.abs(String(invoice.id).length) % colorClasses.length],
    journalNo: invoice.journalNo || "",
    paymentStatus,
    amountReceived,
    paymentHistory,
    adminReviewStatus,
    verificationStatus: adminReviewStatus,
    submittedBy,
    submittedByName: submittedBy.name,
    submittedByRole: submittedBy.roleLabel,
    submittedByDepartment: submittedBy.department,
    enteredByName: submittedBy.name,
    enteredByRole: submittedBy.roleLabel,
    enteredByDepartment: submittedBy.department,
    verifiedByName: verifiedBy?.name || "Not verified",
    verifiedByRole: verifiedBy?.roleLabel || "",
    verifiedAt: invoice.verifiedAt || "",
    approvedByName: approvedBy?.name || "",
    approvedByRole: approvedBy?.roleLabel || "",
    approvedAt: approvedBy ? invoice.reviewedAt || "" : "",
    reviewedByName: reviewedBy?.name || "",
    reviewedAt: invoice.reviewedAt || "",
    lastUpdatedByName: updatedBy?.name || "System",
    lastUpdatedByRole: updatedBy?.roleLabel || "",
    lastUpdatedAt: invoice.updatedAt || invoice.createdAt,
    entryDateTime: invoice.createdAt,
    officePresenceStatus: entryActivity?.officeStatus || "Unknown",
    entryDeviceStatus: entryActivity?.deviceSessionStatus || "No Active Session",
    entryActivityType: entryActivity?.activityType || "Invoice",
    activityStatus: submittedBy.activeStatus,
    duplicateJournalWarning: getInvoiceDuplicateWarning(invoice),
    blockchainStorageStatus: invoice.blockchain?.transactionId
      ? "Stored"
      : paymentStatus === "Paid"
        ? "Pending Commit"
        : "Not Stored",
    auditNotes: invoice.adminReviewRemarks || invoice.verificationRemarks || "No admin notes yet.",
  };
};

const buildSeedLedger = (invoices) => {
  const records = [];
  const history = [];
  invoices.forEach((invoice) => {
    if (!invoice.blockchain?.transactionId) return;
    const record = {
      journalNumber: invoice.journalNo,
      invoiceId: invoice.id,
      clientNameHash: `seed-${invoice.id}-${invoice.journalNo}`,
      amount: invoice.amountReceived || invoice.invoiceAmount,
      currency: invoice.currency,
      paymentStatus: "Paid",
      verifiedBy: invoice.verifiedBy,
      verifiedAt: invoice.verifiedAt,
      paymentReferenceHash: `seed-hash-${invoice.paymentReference}`,
      createdAt: invoice.blockchain.committedAt,
      transactionId: invoice.blockchain.transactionId,
      blockNumber: invoice.blockchain.blockNumber,
      corrections: [],
    };
    records.push(record);
    history.push({
      id: uuidv4(),
      journalNumber: invoice.journalNo,
      action: "CREATE_PAID_INVOICE",
      actorId: invoice.blockchain.submittedBy,
      transactionId: invoice.blockchain.transactionId,
      createdAt: invoice.blockchain.committedAt,
      payload: record,
    });
  });
  return { records, history };
};

const buildSeedActivities = (auditLogs, users) =>
  auditLogs.map((log, index) => {
    const actor = users.find((user) => user.id === log.actorId) || {
      id: log.actorId,
      name: log.actorName,
      role: "employee",
      active: true,
    };
    const ipAddress = index % 4 === 0 ? "192.168.1.42" : "127.0.0.1";
    return {
      id: uuidv4(),
      employeeId: actor.id,
      employeeName: actor.name,
      role: actor.role,
      roleLabel: roleLabels[actor.role] || actor.role,
      department: getDepartment(actor.role),
      action: log.action,
      actionPerformed: actionLabels[log.action] || log.action,
      activityType: log.action.includes("PAYMENT") || log.action.includes("VERIFIED")
        ? "Payment"
        : log.action.includes("INVOICE")
          ? "Invoice"
        : log.action.includes("BLOCKCHAIN")
          ? "Blockchain"
          : log.action.includes("AUDIT")
            ? "Audit"
            : "Administration",
      recordId: log.entityId,
      entryTime: log.createdAt,
      officeStatus: isPrivateIp(ipAddress) ? "In Office" : "Remote / Unverified",
      deviceSessionStatus: "Seeded Session",
      activeStatus: actor.active ? "Inactive" : "Inactive",
      lastSeen: log.createdAt,
      status: "Completed",
      remarks: log.details,
      ipAddress,
      userAgent: "Seeded CountTale Session",
      sessionId: "",
      createdAt: log.createdAt,
    };
  });

const seedDatabase = async () => {
  const users = await Promise.all(
    seedUsers.map(async ({ password, ...user }) => ({
      ...user,
      passwordHash: await bcrypt.hash(password, 10),
    })),
  );

  const invoices = seedInvoices.map((invoice, index) =>
    decorateInvoice({
      ...invoice,
      color: colorClasses[index % colorClasses.length],
    }),
  );
  const ledger = buildSeedLedger(invoices);

  const auditLogs = invoices.flatMap((invoice) => {
    const entries = [
      {
        id: uuidv4(),
        actorId: invoice.enteredBy,
        actorName: users.find((u) => u.id === invoice.enteredBy)?.name || "System",
        action: "INVOICE_CREATED",
        entityType: "invoice",
        entityId: invoice.id,
        details: `Invoice ${invoice.journalNo} created for ${invoice.clientName}.`,
        createdAt: invoice.createdAt,
      },
    ];
    if (invoice.verifiedBy) {
      entries.push({
        id: uuidv4(),
        actorId: invoice.verifiedBy,
        actorName: users.find((u) => u.id === invoice.verifiedBy)?.name || "Administrator",
        action: "PAYMENT_VERIFIED",
        entityType: "invoice",
        entityId: invoice.id,
        details: `Payment marked ${invoice.paymentStatus} with reference ${invoice.paymentReference}.`,
        createdAt: invoice.verifiedAt || invoice.updatedAt,
      });
    }
    if (invoice.blockchain?.transactionId) {
      entries.push({
        id: uuidv4(),
        actorId: invoice.blockchain.submittedBy,
        actorName: users.find((u) => u.id === invoice.blockchain.submittedBy)?.name || "Administrator",
        action: "BLOCKCHAIN_COMMITTED",
        entityType: "invoice",
        entityId: invoice.id,
        details: `Fabric transaction ${invoice.blockchain.transactionId} stored for journal ${invoice.journalNo}.`,
        createdAt: invoice.blockchain.committedAt,
      });
    }
    return entries;
  });

  return {
    version: 1,
    users,
    invoices,
    auditLogs,
    activityLogs: buildSeedActivities(auditLogs, users),
    sessions: [],
    ledgerRecords: ledger.records,
    ledgerHistory: ledger.history,
    corrections: [],
    notifications: [],
    timingExceptions: [],
  };
};

const persist = async () => {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(db, null, 2));
};

export const initStore = async () => {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    db = JSON.parse(raw);
    db.users = db.users || [];
    const originalUserCount = db.users.length;
    db.users = db.users.filter((user) => user.role !== "auditor");
    let needsPersist = db.users.length !== originalUserCount;
    db.users.forEach((user) => {
      const brandedIdentity = demoIdentityRebrand.get(user.email?.toLowerCase());
      if (brandedIdentity) {
        if (user.email !== brandedIdentity.email) {
          user.email = brandedIdentity.email;
          needsPersist = true;
        }
        if (user.workId !== brandedIdentity.workId) {
          user.workId = brandedIdentity.workId;
          needsPersist = true;
        }
      }
      if (user.email?.toLowerCase() === superAdminProfile.email && user.workId?.startsWith("FT-")) {
        user.workId = user.workId.replace(/^FT-/, "CT-");
        needsPersist = true;
      }
    });
    let owner = db.users.find((user) => user.email?.toLowerCase() === superAdminProfile.email);
    if (!owner) owner = db.users.find((user) => user.id === superAdminProfile.id);
    if (!owner) owner = db.users.find((user) => isAdminLevelRole(user.role));
    if (owner) {
      db.users.forEach((user) => {
        if (user.id !== owner.id && user.role === "super_admin") {
          user.role = "admin";
          needsPersist = true;
        }
      });
      Object.assign(owner, {
        name: superAdminProfile.name,
        email: superAdminProfile.email,
        designation: superAdminProfile.designation,
        avatar: superAdminProfile.avatar,
        phone: owner.phone || "+975 17112233",
        location: owner.location || "Thimphu, Bhutan",
        workId: owner.workId || "CT-992-ADM",
        joined: owner.joined || "January 2024",
        active: true,
        passwordHash: owner.passwordHash,
        role: "super_admin",
      });
      needsPersist = true;
    }
    if (!db.users.some((user) => user.email?.toLowerCase() === "admin@counttale.bt")) {
      db.users.push({
        id: uuidv4(),
        name: "Karma Dorji",
        email: "admin@counttale.bt",
        passwordHash: await bcrypt.hash("Admin@123", 10),
        role: "admin",
        designation: "Manager",
        phone: "+975 17112233",
        location: "Thimphu, Bhutan",
        workId: "CT-993-ADM",
        joined: "January 2024",
        active: true,
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Karma&backgroundColor=e2e8f0",
      });
      needsPersist = true;
    }
    if (!db.users.some((user) => user.email?.toLowerCase() === verifierProfile.email)) {
      db.users.push({
        ...verifierProfile,
        passwordHash: await bcrypt.hash("Verifier@123", 10),
        role: "verifier",
      });
      needsPersist = true;
    }
    db.invoices = db.invoices || [];
    const verifierDemoInvoices = new Map([
      ["inv-001", { verifiedAt: "2026-05-08T09:32:00.000Z", blockchainSubmitter: true }],
      ["inv-002", { verifiedAt: "2026-05-05T09:20:00.000Z" }],
      ["inv-003", { verifiedAt: "2026-05-04T10:20:00.000Z" }],
    ]);
    db.invoices.forEach((invoice) => {
      const verifierDemo = verifierDemoInvoices.get(invoice.id);
      if (verifierDemo && invoice.verifiedBy !== verifierProfile.id) {
        invoice.verifiedBy = verifierProfile.id;
        invoice.verifiedAt = verifierDemo.verifiedAt;
        if (verifierDemo.blockchainSubmitter && invoice.blockchain) {
          invoice.blockchain.submittedBy = verifierProfile.id;
        }
        needsPersist = true;
      }
      const paymentHistory = normalizePaymentEntries(invoice.paymentHistory).map((entry, index) => ({
        ...entry,
        journalNo: entry.journalNo || (index === 0 ? invoice.journalNo : ""),
      }));
      if (!paymentHistory.length && toAmount(invoice.amountReceived) > 0) {
        const recorder = db.users.find((user) => user.id === (invoice.verifiedBy || invoice.enteredBy));
        paymentHistory.push(buildPaymentEntry({
          journalNo: invoice.journalNo,
          amount: invoice.amountReceived,
          paymentSender: invoice.paymentSender,
          paymentMethod: invoice.paymentMethod,
          paymentReference: invoice.paymentReference,
          paymentDate: invoice.paymentDate,
          verificationRemarks: invoice.verificationRemarks,
          recordedAt: invoice.verifiedAt || invoice.updatedAt || invoice.createdAt,
        }, recorder));
      }
      const amountReceived = paymentHistory.length ? sumPaymentEntries(paymentHistory) : toAmount(invoice.amountReceived);
      const paymentStatus = calculatePaymentStatus(invoice.invoiceAmount, amountReceived);
      if (invoice.amountReceived !== amountReceived) {
        invoice.amountReceived = amountReceived;
        needsPersist = true;
      }
      if (invoice.paymentStatus !== paymentStatus) {
        invoice.paymentStatus = paymentStatus;
        needsPersist = true;
      }
      if (paymentHistory.length && JSON.stringify(invoice.paymentHistory || []) !== JSON.stringify(paymentHistory)) {
        invoice.paymentHistory = paymentHistory;
        needsPersist = true;
      }
    });
    db.auditLogs = db.auditLogs || [];
    db.sessions = db.sessions || [];
    db.activityLogs = db.activityLogs || buildSeedActivities(db.auditLogs, db.users);
    db.ledgerRecords = db.ledgerRecords || [];
    db.ledgerHistory = db.ledgerHistory || [];
    db.corrections = db.corrections || [];
    db.notifications = db.notifications || [];
    db.timingExceptions = db.timingExceptions || [];
    if (needsPersist) await persist();
  } catch {
    db = await seedDatabase();
    await persist();
  }
};

export const getStorageInfo = () => ({
  driver: process.env.DATABASE_URL ? "local-file-demo-with-postgres-config" : "local-file-demo",
  path: dataFile,
  postgresConfigured: Boolean(process.env.DATABASE_URL),
});

export const findUserByEmail = (email) =>
  db.users.find((user) => user.role !== "auditor" && user.email.toLowerCase() === String(email || "").toLowerCase());

export const findUserById = (id) => db.users.find((user) => user.id === id);

export const publicUser = sanitizeUser;

export const listUsers = () => db.users.filter((user) => user.role !== "auditor").map(sanitizeUser);

const activeUsers = () => db.users.filter((user) => user.active !== false && user.role !== "auditor");

export const listNotificationRecipients = (actor) => {
  const users = activeUsers().filter((user) => user.id !== actor.id);
  if (["super_admin", "admin"].includes(actor.role)) {
    return {
      groups: [
        { id: "all", label: "All Staff" },
        { id: "role:employee", label: "All Employees" },
        { id: "role:verifier", label: "All Verifiers" },
        { id: "role:admin", label: "All Admins" },
      ],
      users: users.map(sanitizeUser),
    };
  }
  if (actor.role === "verifier") {
    return {
      groups: [{ id: "role:employee", label: "All Employees" }],
      users: users.filter((user) => user.role === "employee").map(sanitizeUser),
    };
  }
  return { groups: [], users: [] };
};

const canSendNotificationTo = (actor, recipient) => {
  if (!recipient || recipient.id === actor.id || recipient.active === false) return false;
  if (["super_admin", "admin"].includes(actor.role)) return true;
  if (actor.role === "verifier") return recipient.role === "employee";
  return false;
};

const resolveNotificationRecipients = (payload = {}, actor) => {
  const target = String(payload.target || payload.recipientId || "").trim();
  let recipients = [];
  if (target === "all") {
    recipients = activeUsers().filter((user) => user.id !== actor.id);
  } else if (target.startsWith("role:")) {
    const role = target.slice(5);
    recipients = activeUsers().filter((user) => user.id !== actor.id && user.role === role);
  } else {
    const recipient = findUserById(target);
    if (recipient) recipients = [recipient];
  }
  recipients = recipients.filter((recipient) => canSendNotificationTo(actor, recipient));
  if (!recipients.length) throw makeHttpError("No valid recipients are available for this message.", 403);
  return recipients;
};

const decorateNotification = (notification, actor) => {
  const isRecipient = notification.recipientId === actor.id;
  const decorated = {
    ...notification,
    direction: isRecipient ? "received" : "sent",
    unread: isRecipient && !notification.readAt,
  };
  if (notification.sensitivePassword) {
    decorated.message = isRecipient
      ? `${notification.message}\n\nTemporary password: ${notification.sensitivePassword}`
      : notification.message;
    if (isRecipient) decorated.revealedPassword = notification.sensitivePassword;
    delete decorated.sensitivePassword;
  }
  return decorated;
};

export const listNotifications = (actor) =>
  db.notifications
    .filter((notification) => notification.recipientId === actor.id || notification.senderId === actor.id)
    .map((notification) => decorateNotification(notification, actor))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

export const createNotification = async (payload = {}, actor, context = {}) => {
  if (actor.role === "employee") {
    throw makeHttpError("Employees can only reply to messages they receive.", 403);
  }
  const title = String(payload.title || "Message from management").trim();
  const message = String(payload.message || "").trim();
  if (!message) throw makeHttpError("Message is required.");
  const recipients = resolveNotificationRecipients(payload, actor);
  const createdAt = now();
  const notifications = recipients.map((recipient) => ({
    id: uuidv4(),
    title,
    message,
    senderId: actor.id,
    senderName: actor.name,
    senderRole: actor.role,
    senderRoleLabel: actor.roleLabel || roleLabels[actor.role] || actor.role,
    recipientId: recipient.id,
    recipientName: recipient.name,
    recipientRole: recipient.role,
    parentId: payload.parentId || "",
    readAt: "",
    createdAt,
  }));
  db.notifications.unshift(...notifications);
  await addAuditLog({
    actor,
    action: "NOTIFICATION_SENT",
    entityType: "notification",
    entityId: notifications[0].id,
    details: `Sent notification to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "NOTIFICATION_SENT",
    entityId: notifications[0].id,
    status: "Completed",
    remarks: `Sent notification to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`,
    context,
  });
  await persist();
  return notifications.map((notification) => decorateNotification(notification, actor));
};

export const markNotificationRead = async (id, actor, context = {}) => {
  const notification = db.notifications.find((item) => item.id === id && item.recipientId === actor.id);
  if (!notification) return null;
  if (!notification.readAt) {
    notification.readAt = now();
    await recordEmployeeActivity({
      actor,
      action: "NOTIFICATION_READ",
      entityId: id,
      status: "Completed",
      remarks: `Read notification from ${notification.senderName}.`,
      context,
    });
    await persist();
  }
  return decorateNotification(notification, actor);
};

export const replyToNotification = async (id, payload = {}, actor, context = {}) => {
  const source = db.notifications.find((item) => item.id === id && item.recipientId === actor.id);
  if (!source) return null;
  const recipient = findUserById(source.senderId);
  if (!recipient || recipient.active === false) throw makeHttpError("The original sender is no longer available.", 400);
  const message = String(payload.message || "").trim();
  if (!message) throw makeHttpError("Reply message is required.");
  const reply = {
    id: uuidv4(),
    title: `Reply: ${source.title}`,
    message,
    senderId: actor.id,
    senderName: actor.name,
    senderRole: actor.role,
    senderRoleLabel: actor.roleLabel || roleLabels[actor.role] || actor.role,
    recipientId: recipient.id,
    recipientName: recipient.name,
    recipientRole: recipient.role,
    parentId: source.id,
    readAt: "",
    createdAt: now(),
  };
  if (!source.readAt) source.readAt = now();
  db.notifications.unshift(reply);
  await addAuditLog({
    actor,
    action: "NOTIFICATION_REPLIED",
    entityType: "notification",
    entityId: reply.id,
    details: `Replied to notification from ${source.senderName}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "NOTIFICATION_REPLIED",
    entityId: reply.id,
    status: "Completed",
    remarks: `Replied to notification from ${source.senderName}.`,
    context,
  });
  await persist();
  return decorateNotification(reply, actor);
};

const makeHttpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeManagedRole = (role = "employee") => {
  const normalized = String(role || "employee").toLowerCase();
  if (!managedRoles.includes(normalized)) {
    throw makeHttpError("Choose Employee, Verifier, or Admin as the account role.");
  }
  return normalized;
};

const isAdminLevelRole = (role) => adminRoles.includes(role);

const requireSuperAdminForAdminAccess = (actor) => {
  if (actor?.role !== "super_admin") {
    throw makeHttpError("Only the Super Admin can assign or manage Admin access.", 403);
  }
};

const activeAdminCount = (excludeId = "") =>
  db.users.filter((user) => user.role === "admin" && user.active !== false && user.id !== excludeId).length;

const ensureAdminLimit = (role, active, excludeId = "") => {
  if (role === "admin" && active !== false && activeAdminCount(excludeId) >= maxActiveAdmins) {
    throw makeHttpError("Only 5 active admin accounts are allowed.");
  }
};

const ensureAtLeastOneSuperAdmin = (targetUser, updates = {}) => {
  if (targetUser.role !== "super_admin" || targetUser.active === false) return;
  const nextRole = updates.role || targetUser.role;
  const nextActive = Object.prototype.hasOwnProperty.call(updates, "active") ? updates.active : targetUser.active;
  const otherActiveSuperAdmins = db.users.filter(
    (user) => user.id !== targetUser.id && user.role === "super_admin" && user.active !== false,
  ).length;
  if ((nextRole !== "super_admin" || nextActive === false) && otherActiveSuperAdmins === 0) {
    throw makeHttpError("At least one active Super Admin account must remain.");
  }
};

const buildAvatar = (name) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || "CountTale")}&backgroundColor=e2e8f0`;

const generateWorkId = (role) => {
  const roleCode = { admin: "ADM", verifier: "VER", employee: "EMP" }[role] || "USR";
  const sequence = String(db.users.length + 1).padStart(3, "0");
  return `CT-${sequence}-${roleCode}`;
};

export const createUser = async (payload = {}, actor, context = {}) => {
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const role = normalizeManagedRole(payload.role);
  const active = payload.active !== false;

  if (!name) throw makeHttpError("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw makeHttpError("Enter a valid email address.");
  if (password.length < 6) throw makeHttpError("Password must be at least 6 characters.");
  if (db.users.some((user) => user.email.toLowerCase() === email)) throw makeHttpError("An account with this email already exists.", 409);
  if (role === "admin") requireSuperAdminForAdminAccess(actor);
  ensureAdminLimit(role, active);

  const user = {
    id: uuidv4(),
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role,
    designation: String(payload.designation || "").trim() || roleLabels[role],
    phone: String(payload.phone || "").trim(),
    location: String(payload.location || "Thimphu, Bhutan").trim(),
    workId: String(payload.workId || "").trim() || generateWorkId(role),
    joined: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    active,
    requiresPasswordReview: true,
    avatar: String(payload.avatar || "").trim() || buildAvatar(name),
  };

  db.users.push(user);
  db.notifications.unshift({
    id: uuidv4(),
    title: "Review your password",
    message: "Your account has been created. Review the temporary password below, then change it from Profile or keep it if you want to continue with it.",
    sensitivePassword: password,
    senderId: actor.id,
    senderName: actor.name,
    senderRole: actor.role,
    senderRoleLabel: actor.roleLabel || roleLabels[actor.role] || actor.role,
    recipientId: user.id,
    recipientName: user.name,
    recipientRole: user.role,
    parentId: "",
    category: "password_review",
    readAt: "",
    createdAt: now(),
  });
  await addAuditLog({
    actor,
    action: "USER_CREATED",
    entityType: "user",
    entityId: user.id,
    details: `Created user ${user.email}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "USER_CREATED",
    entityId: user.id,
    status: "Completed",
    remarks: `Created account for ${user.email}.`,
    context,
  });
  await persist();
  return sanitizeUser(user);
};

export const changeOwnPassword = async (payload = {}, actor, context = {}) => {
  const user = findUserById(actor.id);
  if (!user) return null;

  if (payload.keepCurrent === true) {
    user.requiresPasswordReview = false;
    await addAuditLog({
      actor,
      action: "PASSWORD_REVIEW_KEPT",
      entityType: "user",
      entityId: user.id,
      details: `Kept current password for ${user.email}.`,
    });
    await recordEmployeeActivity({
      actor,
      action: "PASSWORD_REVIEW_KEPT",
      entityId: user.id,
      status: "Completed",
      remarks: "Confirmed current password can stay active.",
      context,
    });
    await persist();
    return sanitizeUser(user);
  }

  const currentPassword = String(payload.currentPassword || "");
  const newPassword = String(payload.newPassword || "");
  if (newPassword.length < 6) throw makeHttpError("New password must be at least 6 characters.");
  const validCurrentPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!validCurrentPassword) throw makeHttpError("Current password is incorrect.", 401);

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.requiresPasswordReview = false;
  await addAuditLog({
    actor,
    action: "PASSWORD_CHANGED",
    entityType: "user",
    entityId: user.id,
    details: `Changed password for ${user.email}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "PASSWORD_CHANGED",
    entityId: user.id,
    status: "Completed",
    remarks: "Changed own account password.",
    context,
  });
  await persist();
  return sanitizeUser(user);
};

export const updateUser = async (id, updates = {}, actor, context = {}) => {
  const user = findUserById(id);
  if (!user) return null;
  const nextUpdates = { ...updates };
  if (Object.prototype.hasOwnProperty.call(nextUpdates, "role")) {
    nextUpdates.role = normalizeManagedRole(nextUpdates.role);
  }
  if (Object.prototype.hasOwnProperty.call(nextUpdates, "email")) {
    const email = String(nextUpdates.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw makeHttpError("Enter a valid email address.");
    if (db.users.some((item) => item.id !== id && item.email.toLowerCase() === email)) {
      throw makeHttpError("An account with this email already exists.", 409);
    }
    nextUpdates.email = email;
  }
  if (Object.prototype.hasOwnProperty.call(nextUpdates, "avatar")) {
    nextUpdates.avatar = String(nextUpdates.avatar || "").trim() || buildAvatar(nextUpdates.name || user.name);
  }
  const nextRole = nextUpdates.role || user.role;
  const roleTouchesAdminAccess = isAdminLevelRole(user.role) || isAdminLevelRole(nextRole);
  if (roleTouchesAdminAccess) requireSuperAdminForAdminAccess(actor);
  if (user.role === "super_admin" && nextUpdates.role && nextUpdates.role !== "super_admin") {
    throw makeHttpError("Super Admin access must be transferred before this account can be changed.");
  }
  ensureAtLeastOneSuperAdmin(user, nextUpdates);
  ensureAdminLimit(nextUpdates.role || user.role, Object.prototype.hasOwnProperty.call(nextUpdates, "active") ? nextUpdates.active : user.active, id);
  const allowed = ["role", "designation", "active", "phone", "location", "name", "email", "workId", "avatar"];
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(nextUpdates, key)) user[key] = nextUpdates[key];
  });
  if (Object.prototype.hasOwnProperty.call(nextUpdates, "password") && String(nextUpdates.password || "").trim()) {
    const password = String(nextUpdates.password || "");
    if (password.length < 6) throw makeHttpError("Password must be at least 6 characters.");
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  await addAuditLog({
    actor,
    action: "USER_UPDATED",
    entityType: "user",
    entityId: id,
    details: `Updated user ${user.email}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "USER_UPDATED",
    entityId: id,
    status: "Completed",
    remarks: `Updated access settings for ${user.email}.`,
    context,
  });
  await persist();
  return sanitizeUser(user);
};

export const deleteUser = async (id, actor, context = {}) => {
  const index = db.users.findIndex((user) => user.id === id);
  if (index === -1) return null;
  const user = db.users[index];
  if (actor?.id === id) throw makeHttpError("You cannot delete your own admin account.", 400);
  if (isAdminLevelRole(user.role)) requireSuperAdminForAdminAccess(actor);
  ensureAtLeastOneSuperAdmin(user, { active: false });
  db.users.splice(index, 1);
  db.sessions.forEach((session) => {
    if (session.userId === id) session.active = false;
  });
  await addAuditLog({
    actor,
    action: "USER_DELETED",
    entityType: "user",
    entityId: id,
    details: `Deleted user ${user.email}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "USER_DELETED",
    entityId: id,
    status: "Completed",
    remarks: `Deleted account for ${user.email}.`,
    context,
  });
  await persist();
  return sanitizeUser(user);
};

export const createUserSession = async (user, context = {}) => {
  const session = {
    id: uuidv4(),
    userId: user.id,
    userName: user.name,
    role: user.role,
    ipAddress: normalizeIp(context.ipAddress || ""),
    officeStatus: getOfficeStatus(context),
    userAgent: context.userAgent || "",
    deviceFingerprint: getDeviceFingerprint(context.userAgent),
    startedAt: now(),
    lastSeen: now(),
    active: true,
  };
  db.sessions.unshift(session);
  await recordEmployeeActivity({
    actor: user,
    action: "LOGIN_SUCCESS",
    entityId: session.id,
    status: "Completed",
    remarks: `Successful login from ${session.officeStatus.toLowerCase()} network context.`,
    context: { ...context, sessionId: session.id },
  });
  await persist();
  return session;
};

export const touchUserSession = async (actor, context = {}, remarks = "Session checked") => {
  const session = getSession(context);
  if (session && session.userId === actor.id) {
    session.lastSeen = now();
    session.active = true;
    session.officeStatus = getOfficeStatus(context);
  }
  const lastActivity = db.activityLogs.find(
    (activity) => activity.employeeId === actor.id && activity.action === "SESSION_ACTIVE",
  );
  if (!lastActivity || Date.now() - new Date(lastActivity.createdAt).getTime() > 5 * 60 * 1000) {
    await recordEmployeeActivity({
      actor,
      action: "SESSION_ACTIVE",
      entityId: context.sessionId || "",
      status: "Completed",
      remarks,
      context,
    });
    await persist();
  }
};

export const isUserSessionActive = (sessionId, userId) => {
  if (!sessionId) return false;
  const session = db.sessions.find((item) => item.id === sessionId && item.userId === userId);
  return Boolean(session?.active);
};

export const invalidateUserSession = async (sessionId, actor, context = {}) => {
  const session = getSession({ sessionId });
  await recordEmployeeActivity({
    actor,
    action: "LOGOUT",
    entityId: sessionId || "",
    status: "Completed",
    remarks: "User logged out and session was closed.",
    context,
  });
  if (session && session.userId === actor?.id) {
    session.active = false;
    session.lastSeen = now();
  }
  await persist();
  return session || null;
};

export const recordEmployeeActivity = async ({ actor, action, entityId = "", status = "Completed", remarks = "", context = {}, createdAt = now() }) => {
  const session = getSession(context);
  if (session && actor?.id === session.userId) {
    session.lastSeen = now();
    session.active = true;
    session.officeStatus = getOfficeStatus(context);
  }
  const activity = buildActivityRecord({ actor, action, entityId, status, remarks, context, createdAt });
  activity.activeStatus = actor?.id ? getActiveStatus(actor.id) : activity.activeStatus;
  activity.lastSeen = actor?.id ? getUserLastSeen(actor.id) || activity.entryTime : activity.entryTime;
  db.activityLogs.unshift(activity);
  return activity;
};

const matchesActivityFilter = (activity, filters = {}) => {
  const q = String(filters.q || "").trim().toLowerCase();
  const date = String(filters.date || "");
  const employee = String(filters.employee || "");
  const department = String(filters.department || "");
  const role = String(filters.role || "");
  const officeStatus = String(filters.officeStatus || "");
  const activityType = String(filters.activityType || "");

  if (date && !activity.entryTime.startsWith(date)) return false;
  if (employee && activity.employeeId !== employee) return false;
  if (department && department !== "All" && activity.department !== department) return false;
  if (role && role !== "All" && activity.role !== role) return false;
  if (officeStatus && officeStatus !== "All" && activity.officeStatus !== officeStatus) return false;
  if (activityType && activityType !== "All" && activity.activityType !== activityType) return false;
  if (!q) return true;
  return [
    activity.employeeName,
    activity.roleLabel,
    activity.actionPerformed,
    activity.recordId,
    activity.officeStatus,
    activity.deviceSessionStatus,
    activity.remarks,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
};

const getActivityIssue = (activity) => {
  const hour = new Date(activity.entryTime).getHours();
  if (activity.action === "BLOCKCHAIN_REVISION_CREATED" || activity.status === "Correction") {
    return {
      type: "Edited After Payment Confirmation",
      reason: "A locked blockchain-confirmed record was updated through the controlled revision process.",
    };
  }
  if (String(activity.remarks || "").toLowerCase().includes("duplicate")) {
    return {
      type: "Duplicate Journal Attempt",
      reason: "The activity mentions a duplicate journal or duplicate record warning.",
    };
  }
  if (hour < 8 || hour >= 18) {
    return {
      type: "Late Entry",
      reason: "The activity happened outside the normal 08:00 to 18:00 work window.",
    };
  }
  if (activity.officeStatus === "Remote / Unverified") {
    return {
      type: "Outside Office Entry",
      reason: "The activity was not confirmed from the office network or approved location signal.",
    };
  }
  if (["Device Changed", "Session Mismatch"].includes(activity.deviceSessionStatus)) {
    return {
      type: "Multiple Failed Attempts",
      reason: "The device or session signal changed and should be reviewed.",
    };
  }
  if (activity.activeStatus === "Inactive") {
    return {
      type: "Inactive User Activity",
      reason: "The user is currently inactive or has not been seen recently.",
    };
  }
  return null;
};

const withLiveActivityState = (activity) => {
  const liveActivity = {
    ...activity,
    activeStatus: getActiveStatus(activity.employeeId),
    lastSeen: getUserLastSeen(activity.employeeId) || activity.lastSeen,
  };
  const issue = getActivityIssue(liveActivity);
  return {
    ...liveActivity,
    issueType: issue?.type || "Normal",
    unusualReason: issue?.reason || "",
  };
};

const minutesFromIso = (value) => {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
};

const lateDeductionFor = (lateMinutes) => {
  if (lateMinutes <= 0) return 0;
  if (lateMinutes < 30) return 500 + lateMinutes;
  return 970 + lateMinutes;
};

const timingExceptionTypes = ["Leave", "Emergency", "Medical", "Official Duty", "Remote Approved", "Other"];

const normalizeTimingDate = (value) => {
  const date = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw makeHttpError("Choose a valid exception date.");
  }
  return date;
};

const activeTimingExceptionFor = (userId, date) =>
  (db.timingExceptions || []).find((exception) => exception.userId === userId && exception.date === date && exception.active !== false);

const applyTimingException = (timing, exception) => {
  if (!exception) {
    return {
      ...timing,
      originalStatus: timing.status,
      originalDeduction: timing.deduction,
      deductionWaived: false,
      payableDeduction: timing.deduction,
      exception: null,
    };
  }
  return {
    ...timing,
    status: "Excused",
    originalStatus: timing.status,
    originalDeduction: timing.deduction,
    deduction: 0,
    deductionWaived: true,
    payableDeduction: 0,
    exception,
    note: `${exception.type} approved by ${exception.approvedByName}. Deduction waived${timing.deduction > 0 ? ` from Nu. ${timing.deduction.toLocaleString()}` : ""}. ${exception.reason}`,
  };
};

const timingStatusFor = (checkInAt) => {
  if (!checkInAt) {
    return {
      status: "Not Checked In",
      lateMinutes: 0,
      deduction: 0,
      note: "No login or activity recorded for the selected date.",
    };
  }
  const arrivalMinutes = minutesFromIso(checkInAt);
  const lateMinutes = Math.max(0, arrivalMinutes - checkInGraceEndMinutes);
  return {
    status: lateMinutes > 0 ? "Late" : arrivalMinutes < checkInStartMinutes ? "Early" : "On Time",
    lateMinutes,
    deduction: lateDeductionFor(lateMinutes),
    note: lateMinutes > 0
      ? `Late by ${lateMinutes} minute${lateMinutes === 1 ? "" : "s"} after 09:30.`
      : "Within the approved 09:00 to 09:30 arrival window.",
  };
};

export const getEmployeeTimingReport = (filters = {}) => {
  const date = String(filters.date || now().slice(0, 10));
  const staff = db.users
    .filter((user) => user.active !== false && user.role !== "super_admin" && user.role !== "auditor")
    .map(sanitizeUser);
  const rows = staff.map((user) => {
    const dayActivities = db.activityLogs
      .filter((activity) => activity.employeeId === user.id && activity.entryTime?.startsWith(date))
      .sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime));
    const checkInActivity = dayActivities.find((activity) => activity.action === "LOGIN_SUCCESS") || dayActivities[0];
    const timing = applyTimingException(timingStatusFor(checkInActivity?.entryTime), activeTimingExceptionFor(user.id, date));
    return {
      userId: user.id,
      name: user.name,
      role: user.role,
      roleLabel: user.roleLabel,
      department: getDepartment(user.role),
      avatar: user.avatar,
      checkInAt: checkInActivity?.entryTime || "",
      firstAction: checkInActivity?.actionPerformed || "",
      officeStatus: checkInActivity?.officeStatus || "Unknown",
      activityCount: dayActivities.length,
      ...timing,
    };
  });
  const lateRows = rows.filter((row) => row.status === "Late");
  const notCheckedInRows = rows.filter((row) => row.status === "Not Checked In");
  const totalDeduction = rows.reduce((sum, row) => sum + row.deduction, 0);
  return {
    date,
    policy: {
      arrivalWindow: "09:00 - 09:30",
      firstLateMinute: "Nu. 501",
      thirtyMinuteLate: "Nu. 1,000",
      afterThirtyMinutes: "Nu. 1,001 at 31 minutes, then + Nu. 1 each minute",
    },
    metrics: {
      staff: rows.length,
      onTime: rows.filter((row) => ["Early", "On Time"].includes(row.status)).length,
      late: lateRows.length,
      notCheckedIn: notCheckedInRows.length,
      excused: rows.filter((row) => row.deductionWaived).length,
      totalDeduction,
      waivedDeduction: rows.reduce((sum, row) => sum + (row.deductionWaived ? row.originalDeduction : 0), 0),
    },
    rows: rows.sort((a, b) => b.originalDeduction - a.originalDeduction || a.name.localeCompare(b.name)),
    generatedAt: now(),
  };
};

export const upsertTimingException = async (payload = {}, actor, context = {}) => {
  const userId = String(payload.userId || "").trim();
  const date = normalizeTimingDate(payload.date);
  const user = findUserById(userId);
  if (!user || user.active === false || user.role === "super_admin" || user.role === "auditor") {
    throw makeHttpError("Choose an active employee or admin for the exception.");
  }
  const type = String(payload.type || "Emergency").trim();
  if (!timingExceptionTypes.includes(type)) {
    throw makeHttpError("Choose a valid exception type.");
  }
  const reason = String(payload.reason || "").trim();
  if (reason.length < 4) {
    throw makeHttpError("Add a short reason for the leave or emergency exception.");
  }
  const existing = activeTimingExceptionFor(userId, date);
  const timestamp = now();
  const exception = {
    id: existing?.id || uuidv4(),
    userId,
    userName: user.name,
    userRole: user.role,
    userRoleLabel: roleLabels[user.role] || user.role,
    date,
    type,
    reason,
    active: true,
    approvedBy: actor.id,
    approvedByName: actor.name,
    approvedAt: timestamp,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
  if (existing) {
    Object.assign(existing, exception);
  } else {
    db.timingExceptions.unshift(exception);
  }
  db.notifications.unshift({
    id: uuidv4(),
    title: "Timing exception approved",
    message: `${type} exception approved for ${date}. Late deduction for this date is waived. Reason: ${reason}`,
    senderId: actor.id,
    senderName: actor.name,
    senderRole: actor.role,
    senderRoleLabel: actor.roleLabel || roleLabels[actor.role] || actor.role,
    recipientId: user.id,
    recipientName: user.name,
    recipientRole: user.role,
    parentId: "",
    readAt: "",
    createdAt: timestamp,
  });
  await addAuditLog({
    actor,
    action: "TIMING_EXCEPTION_APPROVED",
    entityType: "employee-timing",
    entityId: `${userId}:${date}`,
    details: `${type} timing exception approved for ${user.name} on ${date}.`,
    meta: { exceptionId: exception.id, userId, date, type, reason },
  });
  await recordEmployeeActivity({
    actor,
    action: "TIMING_EXCEPTION_APPROVED",
    entityId: exception.id,
    status: "Approved",
    remarks: `${type} timing exception approved for ${user.name} on ${date}.`,
    context,
  });
  await persist();
  return exception;
};

export const removeTimingException = async (payload = {}, actor, context = {}) => {
  const userId = String(payload.userId || "").trim();
  const date = normalizeTimingDate(payload.date);
  const exception = activeTimingExceptionFor(userId, date);
  if (!exception) return null;
  const timestamp = now();
  exception.active = false;
  exception.removedBy = actor.id;
  exception.removedByName = actor.name;
  exception.removedAt = timestamp;
  exception.updatedAt = timestamp;
  const user = findUserById(userId);
  if (user) {
    db.notifications.unshift({
      id: uuidv4(),
      title: "Timing exception removed",
      message: `The ${exception.type} exception for ${date} was removed. Late deduction may apply again if the attendance record is late.`,
      senderId: actor.id,
      senderName: actor.name,
      senderRole: actor.role,
      senderRoleLabel: actor.roleLabel || roleLabels[actor.role] || actor.role,
      recipientId: user.id,
      recipientName: user.name,
      recipientRole: user.role,
      parentId: "",
      readAt: "",
      createdAt: timestamp,
    });
  }
  await addAuditLog({
    actor,
    action: "TIMING_EXCEPTION_REMOVED",
    entityType: "employee-timing",
    entityId: `${userId}:${date}`,
    details: `Timing exception removed for ${exception.userName} on ${date}.`,
    meta: { exceptionId: exception.id, userId, date },
  });
  await recordEmployeeActivity({
    actor,
    action: "TIMING_EXCEPTION_REMOVED",
    entityId: exception.id,
    status: "Removed",
    remarks: `Timing exception removed for ${exception.userName} on ${date}.`,
    context,
  });
  await persist();
  return exception;
};

export const listEmployeeActivities = (filters = {}) =>
  db.activityLogs
    .map(withLiveActivityState)
    .filter((activity) => matchesActivityFilter(activity, filters))
    .sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime));

export const getEmployeeActivityReport = (filters = {}) => {
  const activities = listEmployeeActivities(filters);
  const today = now().slice(0, 10);
  const todaysActivities = db.activityLogs.filter((activity) => activity.entryTime.startsWith(today));
  const todaysEntries = todaysActivities.filter((activity) =>
    ["INVOICE_CREATED", "INVOICE_UPDATED", "PAYMENT_STATUS_UPDATED", "PAYMENT_VERIFIED", "BLOCKCHAIN_COMMITTED"].includes(activity.action),
  );
  const liveEmployees = db.users
    .map((user) => ({
      ...sanitizeUser(user),
      department: getDepartment(user.role),
      lastSeen: getUserLastSeen(user.id),
      activeStatus: getActiveStatus(user.id),
      officeStatus: db.sessions.find((session) => session.userId === user.id)?.officeStatus || "Unknown",
    }))
    .filter((user) => user.activeStatus === "Active");

  const officeEmployees = liveEmployees.filter((user) => user.officeStatus === "In Office");
  const inactiveEmployees = db.users
    .map((user) => ({
      ...sanitizeUser(user),
      department: getDepartment(user.role),
      lastSeen: getUserLastSeen(user.id),
      activeStatus: getActiveStatus(user.id),
    }))
    .filter((user) => {
      if (user.activeStatus === "Active") return false;
      if (!user.lastSeen) return true;
      return Date.now() - new Date(user.lastSeen).getTime() > inactiveWindowMs;
    });

  const unusualEntries = db.activityLogs
    .map(withLiveActivityState)
    .filter((activity) => activity.issueType !== "Normal")
    .sort((a, b) => new Date(b.entryTime || 0) - new Date(a.entryTime || 0));

  return {
    metrics: {
      liveActiveEmployees: liveEmployees.length,
      todaysTotalEntries: todaysEntries.length,
      employeesCurrentlyInOffice: officeEmployees.length,
      inactiveEmployees: inactiveEmployees.length,
      unusualEntries: unusualEntries.length,
    },
    liveEmployees,
    officeEmployees,
    inactiveEmployees,
    unusualEntries,
    recentTimeline: activities.slice(0, 12),
    auditHistory: db.auditLogs.slice(0, 12),
    activities,
    filters: {
      employees: db.users.map((user) => ({
        id: user.id,
        name: user.name,
        role: user.role,
        department: getDepartment(user.role),
      })),
      departments: [...new Set(db.users.map((user) => getDepartment(user.role)))],
      roles: Object.keys(roleLabels),
      officeStatuses: ["In Office", "Remote / Unverified", "Location Permission Enabled", "Unknown"],
      activityTypes: ["Invoice", "Payment", "Session", "Blockchain", "Audit", "Administration"],
    },
    generatedAt: now(),
  };
};

const canReadAll = (user) => ["verifier", "admin", "super_admin"].includes(user.role);

export const listInvoices = (user, filters = {}) => {
  const q = String(filters.q || "").trim().toLowerCase();
  const status = String(filters.status || "All");
  const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
  const to = filters.dateTo ? new Date(filters.dateTo) : null;
  const scoped = canReadAll(user)
    ? db.invoices
    : db.invoices.filter((invoice) => invoice.enteredBy === user.id);

  return scoped
    .filter((invoice) => {
      if (status !== "All" && invoice.paymentStatus !== status) return false;
      if (from && new Date(invoice.invoiceDate) < from) return false;
      if (to && new Date(invoice.invoiceDate) > to) return false;
      if (!q) return true;
      return [
        invoice.clientName,
        invoice.clientType,
        invoice.citizenship,
        invoice.cid,
        invoice.passport,
        invoice.country,
        invoice.journalNo,
        invoice.currency,
        invoice.paymentStatus,
        invoice.paymentReference,
        invoice.blockchain?.transactionId,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .map(decorateInvoice);
};

export const getInvoiceById = (id, user) => {
  const invoice = db.invoices.find((item) => item.id === id);
  if (!invoice) return null;
  if (!canReadAll(user) && invoice.enteredBy !== user.id) return null;
  const audit = db.auditLogs
    .filter((log) => log.entityId === id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const corrections = db.corrections.filter((entry) => entry.invoiceId === id);
  return decorateInvoice({ ...invoice, audit, corrections });
};

export const journalExists = (journalNo, excludeId = "") => {
  const normalized = String(journalNo || "").trim().toLowerCase();
  if (!normalized) return false;
  return db.invoices.some((invoice) => {
    if (invoice.id === excludeId) return false;
    if (String(invoice.journalNo || "").trim().toLowerCase() === normalized) return true;
    return normalizePaymentEntries(invoice.paymentHistory).some(
      (entry) => entry.journalNo.toLowerCase() === normalized,
    );
  });
};

const validateInvoicePayload = (payload) => {
  const required = ["clientName", "clientType", "citizenship", "journalNo", "invoiceDate", "invoiceAmount", "currency"];
  const missing = required.filter((field) => !String(payload[field] || "").trim());
  if (payload.citizenship === "Bhutanese" && !payload.cid && !payload.passport) {
    missing.push("cid or passport");
  }
  if (payload.citizenship === "Foreigner" && !payload.passport) {
    missing.push("passport");
  }
  if (payload.citizenship === "Foreigner" && !payload.workPassNumber) {
    missing.push("workPassNumber");
  }
  if (payload.citizenship === "Foreigner" && !payload.zipCode) {
    missing.push("zipCode");
  }
  if (toAmount(payload.invoiceAmount) <= 0) {
    missing.push("invoiceAmount");
  }
  return missing;
};

export const createInvoice = async (payload, actor, context = {}) => {
  const missing = validateInvoicePayload(payload);
  if (missing.length) {
    const error = new Error(`Missing or invalid fields: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
  if (journalExists(payload.journalNo)) {
    const error = new Error("Journal number already exists.");
    error.status = 409;
    throw error;
  }

  const invoiceAmount = toAmount(payload.invoiceAmount);
  const paymentHistory = normalizePaymentEntries(payload.paymentHistory || payload.paymentEntries).map((entry, index) => ({
    ...entry,
    journalNo: entry.journalNo || (index === 0 ? payload.journalNo.trim() : ""),
    recordedBy: entry.recordedBy || actor.id,
    recordedByName: entry.recordedByName || actor.name,
  }));
  const submittedPaymentJournals = paymentHistory.map((entry) => entry.journalNo.toLowerCase()).filter(Boolean);
  if (new Set(submittedPaymentJournals).size !== submittedPaymentJournals.length) {
    throw makeHttpError("Each payment must use a unique journal number.", 409);
  }
  const conflictingPaymentJournal = paymentHistory.find(
    (entry) => entry.journalNo && entry.journalNo.toLowerCase() !== payload.journalNo.trim().toLowerCase() && journalExists(entry.journalNo),
  );
  if (conflictingPaymentJournal) {
    throw makeHttpError(`Payment journal ${conflictingPaymentJournal.journalNo} already exists.`, 409);
  }
  if (!paymentHistory.length && toAmount(payload.amountReceived) > 0) {
    paymentHistory.push(buildPaymentEntry(payload, actor));
  }
  const amountReceived = paymentHistory.length ? sumPaymentEntries(paymentHistory) : toAmount(payload.amountReceived);
  const invoice = {
    id: uuidv4(),
    clientName: payload.clientName.trim(),
    clientType: payload.clientType,
    citizenship: payload.citizenship,
    cid: payload.cid || "",
    passport: payload.passport || payload.foreignNumber || "",
    workPassNumber: payload.citizenship === "Foreigner" ? payload.workPassNumber || "" : "",
    zipCode: payload.citizenship === "Foreigner" ? payload.zipCode || "" : "",
    companyLogo: payload.companyLogo || "",
    companyLogoName: payload.companyLogoName || "",
    companyLogoSource: payload.companyLogoSource || "",
    country: payload.country || (payload.citizenship === "Bhutanese" ? "Bhutan" : "International"),
    location: payload.location || (payload.citizenship === "Bhutanese" ? "Thimphu, Bhutan" : payload.country || "International"),
    organizationName: payload.organizationName || payload.clientName.trim(),
    invoiceDate: payload.invoiceDate,
    journalNo: payload.journalNo.trim(),
    invoiceAmount,
    currency: payload.currency || "BTN",
    description: payload.description || "",
    paymentStatus: calculatePaymentStatus(invoiceAmount, amountReceived),
    paymentSender: payload.paymentSender || "",
    paymentMethod: payload.paymentMethod || "",
    paymentReference: payload.paymentReference || "",
    amountReceived,
    paymentHistory,
    paymentDate: payload.paymentDate || "",
    verificationRemarks: payload.verificationRemarks || "",
    verifiedBy: "",
    verifiedAt: "",
    enteredBy: actor.id,
    adminReviewStatus: "Pending Review",
    adminReviewRemarks: "Submitted by employee and awaiting admin review.",
    reviewedBy: "",
    reviewedAt: "",
    createdAt: now(),
    updatedAt: now(),
    updatedBy: actor.id,
    bank: payload.bank || "",
    blockchain: null,
    financialData: payload.financialData || {},
    initials: initialsFor(payload.clientName),
    color: colorClasses[db.invoices.length % colorClasses.length],
  };

  db.invoices.unshift(invoice);
  await addAuditLog({
    actor,
    action: "INVOICE_CREATED",
    entityType: "invoice",
    entityId: invoice.id,
    details: `Created invoice ${invoice.journalNo} for ${invoice.clientName}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "INVOICE_CREATED",
    entityId: invoice.id,
    status: invoice.paymentStatus,
    remarks: `Submitted invoice ${invoice.journalNo} for ${invoice.clientName}.`,
    context,
  });
  await persist();
  return decorateInvoice(invoice);
};

const createLockedRecordRevision = async (invoice, payload, actor, context, { correctionType, sourceAction, fields }) => {
  const reason = assertRevisionApproval(payload);
  const changedFields = buildFieldChanges(invoice, payload, fields);
  if (!changedFields.length && payload.auditStatus) {
    changedFields.push({
      field: "auditStatus",
      from: invoice.auditStatus || {},
      to: payload.auditStatus,
    });
  }

  const correction = await createCorrection(
    invoice.id,
    {
      reason,
      correctionType,
      sourceAction,
      status: "Submitted",
      revisionAction: "BLOCKCHAIN_REVISION_CREATED",
      changedFields,
      correctedFields: changedFields.reduce((acc, change) => {
        acc[change.field] = { from: change.from, to: change.to };
        return acc;
      }, {}),
      originalValues: changedFields.reduce((acc, change) => {
        acc[change.field] = change.from;
        return acc;
      }, {}),
      proposedValues: changedFields.reduce((acc, change) => {
        acc[change.field] = change.to;
        return acc;
      }, {}),
    },
    actor,
    context,
  );

  return {
    invoice: decorateInvoice(invoice),
    correction,
  };
};

export const updateInvoice = async (id, payload, actor, context = {}) => {
  const invoice = db.invoices.find((item) => item.id === id);
  if (!invoice) return null;
  const canCorrectInvoice =
    ["verifier", "admin", "super_admin"].includes(actor.role) ||
    invoice.enteredBy === actor.id;
  if (!canCorrectInvoice) throw makeHttpError("You can only edit your own records unless you are an administrator.", 403);
  if (payload.journalNo && journalExists(payload.journalNo, id)) {
    const error = new Error("Journal number already exists.");
    error.status = 409;
    throw error;
  }

  const mutableFields = [
    "clientName",
    "clientType",
    "citizenship",
    "cid",
    "passport",
    "workPassNumber",
    "zipCode",
    "companyLogo",
    "companyLogoName",
    "companyLogoSource",
    "country",
    "location",
    "organizationName",
    "invoiceDate",
    "journalNo",
    "currency",
    "description",
    "paymentSender",
    "paymentMethod",
    "paymentReference",
    "paymentDate",
    "verificationRemarks",
    "bank",
    "invoiceAmount",
    "amountReceived",
    "paymentHistory",
    "financialData",
  ];

  if (isBlockchainLocked(invoice)) {
    const { invoice: lockedInvoice } = await createLockedRecordRevision(invoice, payload, actor, context, {
      correctionType: "Invoice Revision",
      sourceAction: "INVOICE_UPDATED",
      fields: mutableFields,
    });
    return lockedInvoice;
  }

  mutableFields.filter((field) => field !== "invoiceAmount" && field !== "amountReceived" && field !== "financialData").forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) invoice[field] = payload[field];
  });
  if (Object.prototype.hasOwnProperty.call(payload, "invoiceAmount")) invoice.invoiceAmount = toAmount(payload.invoiceAmount);
  if (Object.prototype.hasOwnProperty.call(payload, "amountReceived")) invoice.amountReceived = toAmount(payload.amountReceived);
  if (Object.prototype.hasOwnProperty.call(payload, "paymentHistory")) {
    invoice.paymentHistory = normalizePaymentEntries(payload.paymentHistory);
    invoice.amountReceived = sumPaymentEntries(invoice.paymentHistory);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "invoiceAmount") || Object.prototype.hasOwnProperty.call(payload, "amountReceived")) {
    invoice.paymentStatus = calculatePaymentStatus(invoice.invoiceAmount, invoice.amountReceived);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "paymentHistory")) {
    invoice.paymentStatus = calculatePaymentStatus(invoice.invoiceAmount, invoice.amountReceived);
  }
  if (payload.financialData) invoice.financialData = { ...invoice.financialData, ...payload.financialData };
  invoice.updatedAt = now();
  invoice.updatedBy = actor.id;

  await addAuditLog({
    actor,
    action: "INVOICE_UPDATED",
    entityType: "invoice",
    entityId: id,
    details: `Updated invoice ${invoice.journalNo}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "INVOICE_UPDATED",
    entityId: id,
    status: invoice.paymentStatus,
    remarks: `Updated invoice ${invoice.journalNo}.`,
    context,
  });
  await persist();
  return decorateInvoice(invoice);
};

export const updateAdminReview = async (id, payload, actor, context = {}) => {
  const invoice = db.invoices.find((item) => item.id === id);
  if (!invoice) return null;
  const reviewStatus = payload.reviewStatus || payload.adminReviewStatus;
  if (!reviewStatuses.includes(reviewStatus)) {
    const error = new Error(`Admin review status must be one of: ${reviewStatuses.join(", ")}.`);
    error.status = 400;
    throw error;
  }

  if (isBlockchainLocked(invoice)) {
    const { invoice: lockedInvoice } = await createLockedRecordRevision(
      invoice,
      {
        ...payload,
        adminReviewStatus: reviewStatus,
        adminReviewRemarks: payload.remarks || payload.adminReviewRemarks || "",
      },
      actor,
      context,
      {
        correctionType: "Admin Review Revision",
        sourceAction: "ADMIN_REVIEW_UPDATED",
        fields: ["adminReviewStatus", "adminReviewRemarks"],
      },
    );
    return lockedInvoice;
  }

  invoice.adminReviewStatus = reviewStatus;
  const reviewRemarks = payload.remarks || payload.adminReviewRemarks || "";
  invoice.adminReviewRemarks = reviewRemarks;
  invoice.reviewedBy = actor.id;
  invoice.reviewedAt = now();
  invoice.updatedAt = now();
  invoice.updatedBy = actor.id;

  await addAuditLog({
    actor,
    action: "ADMIN_REVIEW_UPDATED",
    entityType: "invoice",
    entityId: id,
    details: `Admin marked journal ${invoice.journalNo} as ${reviewStatus}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "ADMIN_REVIEW_UPDATED",
    entityId: id,
    status: reviewStatus,
    remarks: reviewRemarks
      ? `${reviewRemarks} Journal ${invoice.journalNo}.`
      : `Admin marked journal ${invoice.journalNo} as ${reviewStatus}.`,
    context,
  });
  await persist();
  return decorateInvoice(invoice);
};

export const updateInvoiceAuditStatus = async (id, payload, actor, context = {}) => {
  const invoice = db.invoices.find((item) => item.id === id);
  if (!invoice) return null;

  const incoming = payload.auditStatus || payload;
  const current = invoice.auditStatus || { docs: [], finalized: false, date: "" };
  const docs = Array.isArray(incoming.docs) ? [...new Set(incoming.docs.map(String))] : current.docs || [];
  const finalized = Boolean(incoming.finalized);

  if (isBlockchainLocked(invoice)) {
    const { invoice: lockedInvoice } = await createLockedRecordRevision(
      invoice,
      {
        ...payload,
        auditStatus: {
          ...current,
          ...incoming,
          docs,
          finalized,
          date: finalized ? incoming.date || current.date || now().slice(0, 10) : incoming.date || current.date || "",
        },
      },
      actor,
      context,
      {
        correctionType: "Document Audit Revision",
        sourceAction: "DOCUMENT_AUDIT_UPDATED",
        fields: ["auditStatus"],
      },
    );
    return lockedInvoice;
  }

  invoice.auditStatus = {
    ...current,
    ...incoming,
    docs,
    finalized,
    date: finalized ? incoming.date || current.date || now().slice(0, 10) : incoming.date || current.date || "",
  };
  invoice.updatedAt = now();
  invoice.updatedBy = actor.id;

  await addAuditLog({
    actor,
    action: "DOCUMENT_AUDIT_UPDATED",
    entityType: "invoice",
    entityId: id,
    details: `Document audit ${invoice.auditStatus.finalized ? "finalized" : "updated"} for journal ${invoice.journalNo}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "DOCUMENT_AUDIT_UPDATED",
    entityId: id,
    status: invoice.auditStatus.finalized ? "Finalized" : "Updated",
    remarks: `Document audit ${invoice.auditStatus.docs.length}/4 for journal ${invoice.journalNo}.`,
    context,
  });
  await persist();
  return decorateInvoice(invoice);
};

export const updatePaymentStatus = async (id, payload, actor, context = {}) => {
  const invoice = db.invoices.find((item) => item.id === id);
  if (!invoice) return null;
  const requestedStatus = payload.paymentStatus === "Pending" ? "Partially Paid" : payload.paymentStatus;
  if (requestedStatus && !["Partially Paid", "Unpaid", "Paid"].includes(requestedStatus)) {
    const error = new Error("Payment status must be Partially Paid, Unpaid, or Paid.");
    error.status = 400;
    throw error;
  }
  if (
    !isBlockchainLocked(invoice) &&
    requestedStatus === "Paid" &&
    !String(payload.amountReceived || payload.paymentEntry?.amount || "").trim()
  ) {
    const error = new Error("Paid payment verification requires amountReceived so the status can be calculated automatically.");
    error.status = 400;
    throw error;
  }
  const currentPaymentHistory = normalizePaymentEntries(invoice.paymentHistory);
  const incomingPaymentEntry = payload.recordPartPayment || payload.paymentEntry
    ? buildPaymentEntry(payload.paymentEntry || payload, actor)
    : null;
  if (requestedStatus === "Unpaid" && (currentPaymentHistory.length || toAmount(invoice.amountReceived) > 0)) {
    const error = new Error("This invoice already has recorded payments. Payment journals cannot be erased; add the remaining payment or submit a correction.");
    error.status = 409;
    throw error;
  }
  if (incomingPaymentEntry && incomingPaymentEntry.amount <= 0) {
    const error = new Error("Part payment amount must be greater than zero.");
    error.status = 400;
    throw error;
  }
  if (incomingPaymentEntry && !incomingPaymentEntry.journalNo) {
    const error = new Error("A new payment journal number is required for every payment received.");
    error.status = 400;
    throw error;
  }
  if (incomingPaymentEntry && journalExists(incomingPaymentEntry.journalNo)) {
    const error = new Error("Payment journal number already exists. Enter a unique journal number for this payment.");
    error.status = 409;
    throw error;
  }
  const currentAmountReceived = currentPaymentHistory.length
    ? sumPaymentEntries(currentPaymentHistory)
    : toAmount(invoice.amountReceived);
  const outstandingBalance = Math.max(0, toAmount(invoice.invoiceAmount) - currentAmountReceived);
  if (incomingPaymentEntry && incomingPaymentEntry.amount > outstandingBalance) {
    const error = new Error(`Payment amount cannot exceed the outstanding balance of ${outstandingBalance}.`);
    error.status = 400;
    throw error;
  }
  const nextPaymentHistory = requestedStatus === "Unpaid"
    ? []
    : incomingPaymentEntry
      ? [...currentPaymentHistory, incomingPaymentEntry]
      : payload.paymentHistory
        ? normalizePaymentEntries(payload.paymentHistory)
        : currentPaymentHistory;
  const nextAmountReceived = incomingPaymentEntry || payload.paymentHistory
    ? sumPaymentEntries(nextPaymentHistory)
    : toAmount(
        Object.prototype.hasOwnProperty.call(payload, "amountReceived")
          ? payload.amountReceived
          : requestedStatus === "Unpaid"
            ? 0
            : requestedStatus === "Paid"
              ? invoice.invoiceAmount
              : invoice.amountReceived,
      );
  const status = calculatePaymentStatus(invoice.invoiceAmount, nextAmountReceived);
  if (status === "Paid") {
    const evidence = {
      paymentSender: payload.paymentSender || incomingPaymentEntry?.sender || invoice.paymentSender,
      paymentMethod: payload.paymentMethod || incomingPaymentEntry?.method || invoice.paymentMethod,
      paymentReference: payload.paymentReference || incomingPaymentEntry?.reference || invoice.paymentReference,
      paymentDate: payload.paymentDate || incomingPaymentEntry?.date || invoice.paymentDate,
      amountReceived: nextAmountReceived,
    };
    const required = ["paymentSender", "paymentMethod", "paymentReference", "paymentDate", "amountReceived"];
    const missing = required.filter((field) => !String(evidence[field] || "").trim());
    if (missing.length) {
      const error = new Error(`Payment verification requires: ${missing.join(", ")}`);
      error.status = 400;
      throw error;
    }
  }
  if (isBlockchainLocked(invoice)) {
    const revisionPayload = { ...payload, paymentStatus: status, amountReceived: nextAmountReceived, paymentHistory: nextPaymentHistory };
    const { invoice: lockedInvoice } = await createLockedRecordRevision(invoice, revisionPayload, actor, context, {
      correctionType: "Payment Revision",
      sourceAction: status === "Paid" ? "PAYMENT_VERIFIED" : "PAYMENT_STATUS_UPDATED",
      fields: [
        "paymentStatus",
        "paymentSender",
        "paymentMethod",
        "paymentReference",
        "paymentDate",
        "amountReceived",
        "paymentHistory",
        "verificationRemarks",
        "bank",
      ],
    });
    return lockedInvoice;
  }

  invoice.paymentStatus = status;
  invoice.paymentSender = payload.paymentSender ?? invoice.paymentSender;
  invoice.paymentMethod = payload.paymentMethod ?? invoice.paymentMethod;
  invoice.paymentReference = payload.paymentReference ?? invoice.paymentReference;
  invoice.paymentDate = payload.paymentDate ?? invoice.paymentDate;
  invoice.amountReceived = nextAmountReceived;
  invoice.paymentHistory = requestedStatus === "Unpaid"
    ? []
    : nextPaymentHistory.length
      ? nextPaymentHistory
      : invoice.paymentHistory || [];
  invoice.verificationRemarks = payload.verificationRemarks ?? invoice.verificationRemarks;
  invoice.bank = payload.bank ?? invoice.bank;
  invoice.verifiedBy = actor.id;
  invoice.verifiedAt = now();
  invoice.updatedAt = now();
  invoice.updatedBy = actor.id;

  await addAuditLog({
    actor,
    action: "PAYMENT_STATUS_UPDATED",
    entityType: "invoice",
    entityId: id,
    details: `Payment status changed to ${status} for journal ${invoice.journalNo}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: status === "Paid" ? "PAYMENT_VERIFIED" : "PAYMENT_STATUS_UPDATED",
    entityId: id,
    status,
    remarks:
      status === "Paid"
        ? `Verified paid invoice ${invoice.journalNo} using reference ${invoice.paymentReference}.`
        : `Payment status changed to ${status} for journal ${invoice.journalNo}.`,
    context,
  });
  await persist();
  return decorateInvoice(invoice);
};

export const attachBlockchainCommit = async (invoiceId, commit, actor, context = {}) => {
  const invoice = db.invoices.find((item) => item.id === invoiceId);
  if (!invoice) return null;
  invoice.blockchain = {
    transactionId: commit.transactionId,
    blockNumber: commit.blockNumber,
    committedAt: commit.createdAt,
    submittedBy: actor.id,
    response: commit.response || "Committed",
  };
  invoice.updatedAt = now();
  invoice.updatedBy = actor.id;
  await addAuditLog({
    actor,
    action: "BLOCKCHAIN_COMMITTED",
    entityType: "invoice",
    entityId: invoiceId,
    details: `Fabric transaction ${commit.transactionId} stored for journal ${invoice.journalNo}.`,
  });
  await recordEmployeeActivity({
    actor,
    action: "BLOCKCHAIN_COMMITTED",
    entityId: invoiceId,
    status: "Committed",
    remarks: `Fabric transaction ${commit.transactionId} stored for journal ${invoice.journalNo}.`,
    context,
  });
  await persist();
  return decorateInvoice(invoice);
};

export const createLedgerRecord = async (record, actor) => {
  if (record.paymentStatus !== "Paid") {
    const error = new Error("Only Paid invoices can be committed to the blockchain ledger.");
    error.status = 400;
    throw error;
  }
  if (db.ledgerRecords.some((entry) => entry.journalNumber === record.journalNumber)) {
    const error = new Error("Paid invoice already exists on the ledger.");
    error.status = 409;
    throw error;
  }
  db.ledgerRecords.push(record);
  db.ledgerHistory.push({
    id: uuidv4(),
    journalNumber: record.journalNumber,
    action: "CREATE_PAID_INVOICE",
    actorId: actor.id,
    transactionId: record.transactionId,
    createdAt: record.createdAt,
    payload: record,
  });
  await persist();
  return record;
};

export const getLedgerRecord = (journalNumber) =>
  db.ledgerRecords.find((entry) => entry.journalNumber.toLowerCase() === String(journalNumber || "").toLowerCase());

export const getLedgerHistory = (journalNumber) =>
  db.ledgerHistory
    .filter((entry) => entry.journalNumber.toLowerCase() === String(journalNumber || "").toLowerCase())
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

export const createCorrection = async (invoiceId, payload, actor, context = {}) => {
  const invoice = db.invoices.find((item) => item.id === invoiceId);
  if (!invoice) return null;
  if (!invoice.blockchain?.transactionId) {
    const error = new Error("Corrections are only required after blockchain commitment.");
    error.status = 400;
    throw error;
  }
  const correction = {
    id: uuidv4(),
    invoiceId,
    journalNumber: invoice.journalNo,
    reason: payload.reason || "",
    correctionType: payload.correctionType || "Correction",
    correctedFields: payload.correctedFields || {},
    changedFields: payload.changedFields || [],
    originalValues: payload.originalValues || {},
    proposedValues: payload.proposedValues || {},
    sourceAction: payload.sourceAction || "",
    status: payload.status || "Submitted",
    originalBlockchainTransactionHash: invoice.blockchain.transactionId,
    originalBlockNumber: invoice.blockchain.blockNumber,
    originalCommittedAt: invoice.blockchain.committedAt,
    createdBy: actor.id,
    createdByName: actor.name,
    createdAt: now(),
  };
  db.corrections.push(correction);
  db.ledgerHistory.push({
    id: uuidv4(),
    journalNumber: invoice.journalNo,
    action: "CREATE_CORRECTION",
    actorId: actor.id,
    transactionId: `CORR-${Date.now()}`,
    createdAt: correction.createdAt,
    payload: correction,
  });
  const auditAction = payload.revisionAction || "CORRECTION_CREATED";
  await addAuditLog({
    actor,
    action: auditAction,
    entityType: "invoice",
    entityId: invoiceId,
    details: `${correction.correctionType} submitted for locked journal ${invoice.journalNo}. Original blockchain transaction ${invoice.blockchain.transactionId} remains unchanged.`,
    meta: {
      correctionId: correction.id,
      originalBlockchainTransactionHash: invoice.blockchain.transactionId,
      changedFields: correction.changedFields,
      reason: correction.reason,
    },
  });
  await recordEmployeeActivity({
    actor,
    action: auditAction,
    entityId: invoiceId,
    status: "Correction",
    remarks: `${correction.correctionType} submitted for locked journal ${invoice.journalNo}. Original blockchain record remains unchanged.`,
    context,
  });
  await persist();
  return correction;
};

export const addAuditLog = async ({ actor, action, entityType, entityId, details, meta = {} }) => {
  const entry = {
    id: uuidv4(),
    actorId: actor?.id || "system",
    actorName: actor?.name || "System",
    action,
    entityType,
    entityId,
    details,
    meta,
    createdAt: now(),
  };
  db.auditLogs.unshift(entry);
  return entry;
};

export const listAuditLogs = (user, filters = {}) => {
  const q = String(filters.q || "").toLowerCase();
  return db.auditLogs
    .filter((log) => {
      if (!canReadAll(user) && log.actorId !== user.id) return false;
      if (!q) return true;
      return [log.actorName, log.action, log.details, log.entityId].join(" ").toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const getStatusReport = (user) => {
  const invoices = listInvoices(user);
  const totals = invoices.reduce(
    (acc, invoice) => {
      acc.total += 1;
      acc.amount += toAmount(invoice.invoiceAmount);
      const paymentStatus = invoice.paymentStatus === "Pending" ? "Partially Paid" : invoice.paymentStatus;
      acc.byStatus[paymentStatus] = (acc.byStatus[paymentStatus] || 0) + 1;
      if (invoice.blockchain?.transactionId) acc.committed += 1;
      return acc;
    },
    { total: 0, amount: 0, committed: 0, byStatus: { Paid: 0, Unpaid: 0, "Partially Paid": 0 } },
  );

  const recent = invoices.slice(0, 8);
  const audit = listAuditLogs(user).slice(0, 8);
  return {
    totals,
    recent,
    audit,
    generatedAt: now(),
  };
};

export const resetDemoData = async () => {
  db = await seedDatabase();
  await persist();
};
