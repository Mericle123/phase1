import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { findUserById, initStore, recordEmployeeActivity, resetDemoData } from "../server/services/store.js";

const port = Number(process.env.E2E_API_PORT || 4194);
const baseUrl = `http://127.0.0.1:${port}/api`;
const testUserAgent = "CountTale E2E Verification";
const uniqueJournal = `J-E2E-${Date.now()}`;

const results = [];
let server;

const fail = (message, details) => {
  const error = new Error(details ? `${message}: ${details}` : message);
  error.details = details;
  throw error;
};

const expect = (condition, message, details = "") => {
  if (!condition) fail(message, details);
};

const request = async (path, { method = "GET", token = "", body, headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": testUserAgent,
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  return { response, payload };
};

const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS ${name}${detail ? ` - ${detail}` : ""}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
    console.error(`FAIL ${name}`);
    console.error(error.message);
    throw error;
  }
};

const login = async (email, password, expectedStatus = 200) => {
  const { response, payload } = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  expect(response.status === expectedStatus, `Expected login status ${expectedStatus}`, JSON.stringify(payload));
  return payload;
};

const waitForHealth = async () => {
  let lastFailure = "";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const { response, payload } = await request("/health");
      if (response.ok && payload.ok) return payload;
      lastFailure = `status ${response.status} ${JSON.stringify(payload)}`;
    } catch {
      lastFailure = "connection failed while waiting for the API listener to bind the port";
    }
    await delay(150);
  }
  fail("API server did not become healthy", lastFailure);
};

const stopServer = async () => {
  if (!server?.listening) return;
  await new Promise((resolve) => server.close(resolve));
};

const validInvoicePayload = (journalNo = uniqueJournal) => ({
  clientName: "E2E Demo Trading",
  clientType: "Corporate",
  citizenship: "Bhutanese",
  cid: "11990011223",
  country: "Bhutan",
  organizationName: "E2E Demo Trading",
  journalNo,
  invoiceDate: "2026-05-31",
  invoiceAmount: 765432,
  currency: "BTN",
  description: "End-to-end verification invoice.",
  financialData: {
    capitalCost: "765432",
    amortization: "10 Years",
    financingCost: "6",
    workingCapital: "120000",
    pnlRevenue: "980000",
    pnlCogs: "360000",
    pnlOpex: "210000",
    cfOpening: "90000",
    cfInflow: "1000000",
    cfOutflow: "590000",
    debtPercent: "42",
    equityPercent: "58",
    cashFlowAnalysis: "Positive operating cash flow with manageable leverage.",
  },
});

try {
  await initStore();
  await resetDemoData();

  process.env.API_PORT = String(port);
  process.env.API_HOST = "127.0.0.1";
  process.env.JWT_SECRET = "counttale-e2e-secret";
  process.env.OFFICE_IP_ALLOWLIST = "127.0.0.1";
  ({ server } = await import("../server/index.js"));
  if (!server.listening) await once(server, "listening");

  await check("API health and storage mode", async () => {
    const health = await waitForHealth();
    expect(health.storage?.driver, "Storage driver was not reported");
    expect(health.blockchain?.mode, "Blockchain mode was not reported");
    return `${health.storage.driver}, ${health.blockchain.mode}`;
  });

  await check("Invalid login is rejected", async () => {
    await login("admin@counttale.bt", "WrongPassword", 401);
    return "401 returned";
  });

  const sessions = {};
  await check("Login and auth/me work for all roles", async () => {
    const accounts = [
      ["superAdmin", "ngawangg927@gmail.com", "Admin@123", "super_admin"],
      ["admin", "admin@counttale.bt", "Admin@123", "admin"],
      ["employee", "employee@counttale.bt", "Employee@123", "employee"],
    ];
    for (const [role, email, password, expectedRole] of accounts) {
      const payload = await login(email, password);
      expect(payload.token, `${role} token missing`);
      expect(payload.user?.role === expectedRole, `${role} mapped to wrong role`, payload.user?.role);
      sessions[role] = payload;
      const me = await request("/auth/me", { token: payload.token });
      expect(me.response.ok, `${role} /auth/me failed`, JSON.stringify(me.payload));
      expect(me.payload.user?.role === expectedRole, `${role} /auth/me returned wrong user`);
    }
    await login("auditor@counttale.bt", "Auditor@123", 401);
    await login("verifier@counttale.bt", "Verifier@123", 401);
    return "super admin, admin, employee";
  });

  await check("Role-based access rules are enforced", async () => {
    const adminCreate = await request("/invoices", {
      method: "POST",
      token: sessions.admin.token,
      body: validInvoicePayload("J-ADMIN-BLOCK"),
    });
    expect(adminCreate.response.status === 403, "Admin should not create normal invoices");

    const employeeUsers = await request("/users", { token: sessions.employee.token });
    expect(employeeUsers.response.status === 403, "Employee should not access user management");
    const employeeActivity = await request("/employee-activity", { token: sessions.employee.token });
    expect(employeeActivity.response.status === 403, "Employee should not access activity monitoring");
    const adminUsers = await request("/users", { token: sessions.admin.token });
    expect(adminUsers.response.ok && adminUsers.payload.users.length >= 3, "Admin should load users");
    expect(!adminUsers.payload.users.some((user) => user.role === "auditor"), "Auditor accounts should not be listed");
    return "employee entry only, admin supervision only";
  });

  await check("Input validation and duplicate journal checks work", async () => {
    const empty = await request("/invoices", {
      method: "POST",
      token: sessions.employee.token,
      body: {},
    });
    expect(empty.response.status === 400, "Empty invoice should fail validation");

    const duplicateCheck = await request("/journals/J-8472/check", { token: sessions.employee.token });
    expect(duplicateCheck.response.ok && duplicateCheck.payload.exists === true, "Duplicate journal check should detect seeded journal");

    const duplicateCreate = await request("/invoices", {
      method: "POST",
      token: sessions.employee.token,
      body: validInvoicePayload("J-8472"),
    });
    expect(duplicateCreate.response.status === 409, "Duplicate journal create should be blocked");
    return "400 and 409 error paths verified";
  });

  let createdInvoice;
  await check("Employee data entry saves to database", async () => {
    const created = await request("/invoices", {
      method: "POST",
      token: sessions.employee.token,
      body: validInvoicePayload(),
    });
    expect(created.response.status === 201, "Employee invoice create failed", JSON.stringify(created.payload));
    createdInvoice = created.payload.invoice;
    expect(createdInvoice.id, "Created invoice ID missing");
    expect(createdInvoice.journalNo === uniqueJournal, "Created journal mismatch");
    expect(createdInvoice.adminReviewStatus === "Pending Review", "New invoice should await admin review");
    expect(createdInvoice.submittedByName === "Pema Lhamo", "Submitted employee name missing");
    expect(createdInvoice.officePresenceStatus === "In Office", "Office presence should be In Office");

    const byId = await request(`/invoices/${createdInvoice.id}`, { token: sessions.employee.token });
    expect(byId.response.ok && byId.payload.invoice?.id === createdInvoice.id, "Created invoice read-back failed");

    const sameJournalCheck = await request(`/journals/${uniqueJournal}/check?excludeId=${createdInvoice.id}`, {
      token: sessions.employee.token,
    });
    expect(sameJournalCheck.response.ok && sameJournalCheck.payload.exists === false, "Exclude ID duplicate check failed");
    return createdInvoice.id;
  });

  await check("Admin dashboard data exposes required employee-submitted record fields", async () => {
    const list = await request("/invoices", { token: sessions.admin.token });
    expect(list.response.ok, "Admin invoice list failed");
    const record = list.payload.invoices.find((invoice) => invoice.id === createdInvoice.id);
    expect(record, "Created employee record not visible to admin");
    for (const key of [
      "submittedByName",
      "submittedByRole",
      "entryDateTime",
      "paymentStatus",
      "journalNo",
      "verificationStatus",
      "officePresenceStatus",
      "activityStatus",
      "blockchainStorageStatus",
      "auditNotes",
    ]) {
      expect(Object.prototype.hasOwnProperty.call(record, key), `Admin record missing ${key}`);
    }
    return "all dashboard fields present";
  });

  await check("Administrator and original employee can correct unlocked records", async () => {
    const adminEdit = await request(`/invoices/${createdInvoice.id}`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: {
        description: "Administrator corrected the invoice note.",
        verificationRemarks: "Administrator reviewed and corrected a data-entry note.",
      },
    });
    expect(adminEdit.response.ok, "Administrator should be able to correct invoice records", JSON.stringify(adminEdit.payload));
    expect(adminEdit.payload.invoice.description.includes("Administrator corrected"), "Administrator correction did not persist");

    const employeeEdit = await request(`/invoices/${createdInvoice.id}`, {
      method: "PATCH",
      token: sessions.employee.token,
      body: {
        location: "Paro, Bhutan",
        description: "Original employee corrected the client location note.",
      },
    });
    expect(employeeEdit.response.ok, "Original employee should be able to correct own invoice", JSON.stringify(employeeEdit.payload));
    expect(employeeEdit.payload.invoice.location === "Paro, Bhutan", "Employee correction did not persist");
    return "administrator correction and employee own-record correction";
  });

  await check("Admin approval, rejection, flagging, and verification update the correct record", async () => {
    const employeeReview = await request(`/invoices/${createdInvoice.id}/review`, {
      method: "PATCH",
      token: sessions.employee.token,
      body: { reviewStatus: "Approved", remarks: "Should fail" },
    });
    expect(employeeReview.response.status === 403, "Employee should not review records");

    for (const status of ["Approved", "Rejected", "Flagged", "Verified"]) {
      const reviewed = await request(`/invoices/${createdInvoice.id}/review`, {
        method: "PATCH",
        token: sessions.admin.token,
        body: { reviewStatus: status, remarks: `E2E ${status} note` },
      });
      expect(reviewed.response.ok, `Admin review ${status} failed`, JSON.stringify(reviewed.payload));
      expect(reviewed.payload.invoice.adminReviewStatus === status, `Review status ${status} was not persisted`);
      expect(reviewed.payload.invoice.id === createdInvoice.id, "Admin review updated the wrong record");
    }
    return "approve, reject, flag, verify";
  });

  await check("Payment validation, update, and blockchain storage work", async () => {
    const unpaidCommit = await request(`/invoices/${createdInvoice.id}/commit`, {
      method: "POST",
      token: sessions.admin.token,
    });
    expect(unpaidCommit.response.status === 400, "Unpaid invoice should not be committed");

    const missingPayment = await request(`/invoices/${createdInvoice.id}/status`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: { paymentStatus: "Paid" },
    });
    expect(missingPayment.response.status === 400, "Paid status should require payment evidence");

    const partial = await request(`/invoices/${createdInvoice.id}/status`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: {
        paymentStatus: "Partially Paid",
        journalNo: uniqueJournal,
        bank: "Bank of Bhutan",
        paymentSender: "E2E Demo Trading",
        paymentMethod: "Bank Transfer",
        paymentReference: `PART-${uniqueJournal}`,
        amountReceived: 250000,
        paymentDate: "2026-05-30",
        verificationRemarks: "E2E partial payment evidence checked.",
        recordPartPayment: true,
        paymentEntry: {
          amount: 250000,
          sender: "E2E Demo Trading",
          method: "Bank Transfer",
          reference: `PART-${uniqueJournal}`,
          date: "2026-05-30",
          remarks: "First part payment.",
        },
      },
    });
    expect(partial.response.ok, "Partial payment update failed", JSON.stringify(partial.payload));
    expect(partial.payload.invoice.paymentStatus === "Partially Paid", "Payment status was not updated to Partially Paid");
    expect(Number(partial.payload.invoice.amountReceived) === 250000, "Partial payment amount did not persist");
    expect(partial.payload.invoice.paymentHistory?.length >= 1, "Partial payment history missing");

    const paid = await request(`/invoices/${createdInvoice.id}/status`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: {
        paymentStatus: "Paid",
        journalNo: uniqueJournal,
        bank: "Bank of Bhutan",
        paymentSender: "E2E Demo Trading",
        paymentMethod: "Bank Transfer",
        paymentReference: `PAY-${uniqueJournal}`,
        amountReceived: 515432,
        paymentDate: "2026-05-31",
        verificationRemarks: "E2E payment evidence checked.",
        recordPartPayment: true,
        paymentEntry: {
          amount: 515432,
          sender: "E2E Demo Trading",
          method: "Bank Transfer",
          reference: `PAY-${uniqueJournal}`,
          date: "2026-05-31",
          remarks: "Remaining balance paid.",
        },
      },
    });
    expect(paid.response.ok, "Paid update failed", JSON.stringify(paid.payload));
    const invoice = paid.payload.invoice;
    expect(invoice.paymentStatus === "Paid", "Payment status was not updated to Paid");
    expect(Number(invoice.amountReceived) === 765432, "Remaining payment did not settle the full invoice amount");
    expect(invoice.blockchainStorageStatus === "Stored", "Blockchain storage status not Stored");
    expect(invoice.blockchain?.transactionId?.startsWith("FABRIC-"), "Fabric transaction ID missing");

    const ledger = await request(`/blockchain/${uniqueJournal}`, { token: sessions.admin.token });
    expect(ledger.response.ok, "Ledger query failed", JSON.stringify(ledger.payload));
    expect(ledger.payload.record?.journalNumber === uniqueJournal, "Ledger journal mismatch");
    expect(ledger.payload.record?.transactionId === invoice.blockchain.transactionId, "Ledger transaction mismatch");

    const originalTx = invoice.blockchain.transactionId;
    const originalPaymentReference = invoice.paymentReference;
    const blockedEdit = await request(`/invoices/${createdInvoice.id}/status`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: {
        paymentStatus: "Paid",
        paymentReference: `PAY-${uniqueJournal}-EDIT`,
      },
    });
    expect(blockedEdit.response.status === 409, "Locked blockchain payment edit should require explicit revision confirmation");

    const revision = await request(`/invoices/${createdInvoice.id}/status`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: {
        paymentStatus: "Paid",
        paymentReference: `PAY-${uniqueJournal}-REVISION`,
        verificationRemarks: "E2E controlled update after blockchain commit.",
        confirmBlockchainRevision: true,
        revisionReason: "E2E verifies locked records create revisions without overwriting blockchain data.",
      },
    });
    expect(revision.response.ok, "Confirmed blockchain revision failed", JSON.stringify(revision.payload));
    expect(revision.payload.invoice.blockchain.transactionId === originalTx, "Original blockchain transaction was overwritten");
    expect(revision.payload.invoice.paymentReference === originalPaymentReference, "Original payment reference should remain unchanged");
    expect(revision.payload.invoice.isBlockchainLocked === true, "Locked invoice flag missing after commit");
    expect(revision.payload.invoice.recordLockStatus === "Locked", "Record lock status missing");
    expect(revision.payload.invoice.tamperProtectionStatus === "Tamper-Protected", "Tamper protection status missing");
    expect(revision.payload.invoice.revisionCount >= 1, "Revision count did not increase");
    expect(revision.payload.invoice.latestRevisionStatus === "Submitted", "Latest revision status should be Submitted");
    expect(
      revision.payload.invoice.revisionHistory?.some((entry) =>
        entry.originalBlockchainTransactionHash === originalTx &&
        entry.reason?.includes("E2E verifies locked records") &&
        entry.changedFields?.some((change) => change.field === "paymentReference"),
      ),
      "Revision history missing changed payment reference and original blockchain hash",
    );

    const afterRevision = await request(`/invoices/${createdInvoice.id}`, { token: sessions.admin.token });
    expect(afterRevision.payload.invoice.blockchain.transactionId === originalTx, "Read-back blockchain transaction changed after revision");
    expect(afterRevision.payload.invoice.paymentReference === originalPaymentReference, "Read-back payment evidence was overwritten");
    expect(afterRevision.payload.invoice.revisionHistory?.length >= 1, "Read-back revision history missing");

    const repeatCommit = await request(`/invoices/${createdInvoice.id}/commit`, {
      method: "POST",
      token: sessions.admin.token,
    });
    expect(repeatCommit.response.ok && repeatCommit.payload.alreadyCommitted === true, "Repeat commit should be idempotent");
    return invoice.blockchain.transactionId;
  });

  await check("Hidden employee activity tracking is recorded automatically", async () => {
    const activity = await request(`/employee-activity/summary?q=${encodeURIComponent(uniqueJournal)}`, {
      token: sessions.admin.token,
    });
    expect(activity.response.ok, "Activity summary failed");
    const activities = activity.payload.activities || [];
    const activityActions = activities.map((item) => item.action);
    for (const action of ["INVOICE_CREATED", "ADMIN_REVIEW_UPDATED", "PAYMENT_VERIFIED", "BLOCKCHAIN_COMMITTED", "BLOCKCHAIN_REVISION_CREATED"]) {
      expect(activityActions.includes(action), `Activity missing ${action}`);
    }
    expect(activities.some((item) => item.officeStatus === "In Office"), "Office status not recorded");
    expect(activity.payload.metrics?.liveActiveEmployees >= 1, "Live active employee metric missing");
    expect(activity.payload.filters?.activityTypes?.includes("Blockchain"), "Activity filters missing Blockchain type");
    return `${activities.length} activity rows`;
  });

  await check("Admin-only employee timing calculates late penalties", async () => {
    const timingDate = "2026-06-03";
    const timingUserResponse = await request("/users", {
      method: "POST",
      token: sessions.admin.token,
      body: {
        name: "E2E Timing Employee",
        email: "timing-employee@counttale.bt",
        password: "Timing@123",
        role: "employee",
      },
    });
    expect(timingUserResponse.response.status === 201, "Timing employee creation failed", JSON.stringify(timingUserResponse.payload));
    const timingUserId = timingUserResponse.payload.user.id;
    await recordEmployeeActivity({
      actor: findUserById("u-admin-regular"),
      action: "LOGIN_SUCCESS",
      entityId: "timing-e2e-admin",
      remarks: "E2E 09:31 timing check.",
      createdAt: `${timingDate}T09:31:00+06:00`,
      context: { ipAddress: "127.0.0.1", userAgent: testUserAgent },
    });
    await recordEmployeeActivity({
      actor: findUserById(timingUserId),
      action: "LOGIN_SUCCESS",
      entityId: "timing-e2e-second-employee",
      remarks: "E2E 10:00 timing check.",
      createdAt: `${timingDate}T10:00:00+06:00`,
      context: { ipAddress: "127.0.0.1", userAgent: testUserAgent },
    });
    await recordEmployeeActivity({
      actor: findUserById("u-employee"),
      action: "LOGIN_SUCCESS",
      entityId: "timing-e2e-employee",
      remarks: "E2E 10:01 timing check.",
      createdAt: `${timingDate}T10:01:00+06:00`,
      context: { ipAddress: "127.0.0.1", userAgent: testUserAgent },
    });

    const timing = await request(`/employee-timing?date=${timingDate}`, { token: sessions.admin.token });
    expect(timing.response.ok, "Admin should access employee timing", JSON.stringify(timing.payload));
    expect(timing.payload.policy?.arrivalWindow === "09:00 - 09:30", "Timing policy window mismatch");
    const byUser = Object.fromEntries((timing.payload.rows || []).map((row) => [row.userId, row]));
    expect(byUser["u-admin-regular"]?.deduction === 501, "09:31 should deduct Nu. 501", JSON.stringify(byUser["u-admin-regular"]));
    expect(byUser[timingUserId]?.deduction === 1000, "10:00 should deduct Nu. 1,000", JSON.stringify(byUser[timingUserId]));
    expect(byUser["u-employee"]?.deduction === 1001, "10:01 should deduct Nu. 1,001", JSON.stringify(byUser["u-employee"]));
    expect(timing.payload.metrics?.late >= 3, "Late staff metric should include controlled timing rows");

    const exception = await request("/employee-timing/exceptions", {
      method: "POST",
      token: sessions.superAdmin.token,
      body: {
        userId: "u-admin-regular",
        date: timingDate,
        type: "Emergency",
        reason: "E2E emergency leave approved before salary deduction.",
      },
    });
    expect(exception.response.status === 201, "Super Admin should approve a timing exception", JSON.stringify(exception.payload));
    const excusedByUser = Object.fromEntries((exception.payload.report.rows || []).map((row) => [row.userId, row]));
    expect(excusedByUser["u-admin-regular"]?.status === "Excused", "Exception should change the row status to Excused");
    expect(excusedByUser["u-admin-regular"]?.deduction === 0, "Approved exception should waive payable deduction");
    expect(excusedByUser["u-admin-regular"]?.originalDeduction === 501, "Original deduction should remain visible");
    expect(exception.payload.report.metrics?.waivedDeduction >= 501, "Waived deduction metric should include exception amount");

    const adminExceptionNotice = await request("/notifications", { token: sessions.admin.token });
    expect(
      adminExceptionNotice.payload.notifications?.some((notice) => notice.title === "Timing exception approved" && notice.message.includes("Emergency")),
      "Approved exception notification missing for affected user",
    );

    const removedException = await request("/employee-timing/exceptions", {
      method: "DELETE",
      token: sessions.superAdmin.token,
      body: {
        userId: "u-admin-regular",
        date: timingDate,
      },
    });
    expect(removedException.response.ok, "Super Admin should remove timing exception", JSON.stringify(removedException.payload));
    const restoredByUser = Object.fromEntries((removedException.payload.report.rows || []).map((row) => [row.userId, row]));
    expect(restoredByUser["u-admin-regular"]?.status === "Late", "Removing exception should restore late status");
    expect(restoredByUser["u-admin-regular"]?.deduction === 501, "Removing exception should restore payable deduction");

    const employeeBlocked = await request(`/employee-timing?date=${timingDate}`, { token: sessions.employee.token });
    expect(employeeBlocked.response.status === 403, "Employee should not access employee timing");
    const deletedTimingUser = await request(`/users/${timingUserId}`, { method: "DELETE", token: sessions.admin.token });
    expect(deletedTimingUser.response.ok, "Timing employee cleanup failed");
    return "09:31, 10:00, 10:01 deductions, exception waiver, and role access";
  });

  await check("User management create, update, deactivate, and delete work", async () => {
    const created = await request("/users", {
      method: "POST",
      token: sessions.admin.token,
      body: {
        name: "E2E Managed User",
        email: "managed-user@counttale.bt",
        password: "Managed@123",
        role: "employee",
        designation: "Data Entry Officer",
        phone: "+975 17000000",
        location: "Thimphu, Bhutan",
      },
    });
    expect(created.response.status === 201 && created.payload.user?.role === "employee", "Create user failed", JSON.stringify(created.payload));
    const createdUser = created.payload.user;

    const managedSession = await login("managed-user@counttale.bt", "Managed@123", 200);
    const managedNotifications = await request("/notifications", { token: managedSession.token });
    const passwordNotice = managedNotifications.payload.notifications?.find((item) => item.category === "password_review");
    expect(passwordNotice?.revealedPassword === "Managed@123", "New user's temporary password should only appear in their own notification");

    const changedPassword = await request("/auth/password", {
      method: "POST",
      token: managedSession.token,
      body: {
        currentPassword: "Managed@123",
        newPassword: "Managed@456",
      },
    });
    expect(changedPassword.response.ok && changedPassword.payload.user?.requiresPasswordReview === false, "Password change failed");
    await login("managed-user@counttale.bt", "Managed@123", 401);
    await login("managed-user@counttale.bt", "Managed@456", 200);

    const detailsUpdate = await request(`/users/${createdUser.id}`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: { designation: "Senior Data Entry Officer", phone: "+975 17111111" },
    });
    expect(detailsUpdate.response.ok && detailsUpdate.payload.user.role === "employee", "Details update failed");

    const rejectVerifier = await request(`/users/${createdUser.id}`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: { role: "verifier" },
    });
    expect(rejectVerifier.response.status === 400, "Verifier role should be rejected");

    const rejectAuditor = await request(`/users/${createdUser.id}`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: { role: "auditor" },
    });
    expect(rejectAuditor.response.status === 400, "Auditor role should be rejected");

    const deactivate = await request(`/users/${createdUser.id}`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: { active: false },
    });
    expect(deactivate.response.ok && deactivate.payload.user.active === false, "Deactivate failed");
    await login("managed-user@counttale.bt", "Managed@456", 401);

    const reactivate = await request(`/users/${createdUser.id}`, {
      method: "PATCH",
      token: sessions.admin.token,
      body: { active: true },
    });
    expect(reactivate.response.ok && reactivate.payload.user.active === true, "Reactivate failed");
    await login("managed-user@counttale.bt", "Managed@456", 200);

    const adminIds = [];
    for (let i = 0; i < 4; i += 1) {
      const admin = await request("/users", {
        method: "POST",
        token: sessions.superAdmin.token,
        body: {
          name: `E2E Admin ${i + 1}`,
          email: `e2e-admin-${i + 1}@counttale.bt`,
          password: "AdminSeat@123",
          role: "admin",
        },
      });
      expect(admin.response.status === 201, "Admin seat creation failed", JSON.stringify(admin.payload));
      adminIds.push(admin.payload.user.id);
    }

    const ordinaryAdmin = await login("e2e-admin-1@counttale.bt", "AdminSeat@123", 200);
    expect(ordinaryAdmin.user?.role === "admin", "Temporary admin login did not receive Admin role");
    const staffByAdmin = await request("/users", {
      method: "POST",
      token: ordinaryAdmin.token,
      body: {
        name: "E2E Staff By Admin",
        email: "staff-by-admin@counttale.bt",
        password: "StaffByAdmin@123",
        role: "employee",
      },
    });
    expect(staffByAdmin.response.status === 201, "Regular admin should create staff accounts", JSON.stringify(staffByAdmin.payload));
    const adminPromotionByAdmin = await request(`/users/${staffByAdmin.payload.user.id}`, {
      method: "PATCH",
      token: ordinaryAdmin.token,
      body: { role: "admin" },
    });
    expect(adminPromotionByAdmin.response.status === 403, "Regular admin should not promote users to Admin");
    const deletedStaffByAdmin = await request(`/users/${staffByAdmin.payload.user.id}`, {
      method: "DELETE",
      token: ordinaryAdmin.token,
    });
    expect(deletedStaffByAdmin.response.ok, "Regular admin should delete staff accounts");

    const tooManyAdmins = await request("/users", {
      method: "POST",
      token: sessions.superAdmin.token,
      body: {
        name: "E2E Admin Extra",
        email: "e2e-admin-extra@counttale.bt",
        password: "AdminSeat@123",
        role: "admin",
      },
    });
    expect(tooManyAdmins.response.status === 400, "Sixth active admin should be blocked");

    for (const adminId of adminIds) {
      const deletedAdmin = await request(`/users/${adminId}`, { method: "DELETE", token: sessions.superAdmin.token });
      expect(deletedAdmin.response.ok, "Temporary admin delete failed");
    }
    const deleted = await request(`/users/${createdUser.id}`, { method: "DELETE", token: sessions.admin.token });
    expect(deleted.response.ok, "Delete user failed");
    await login("managed-user@counttale.bt", "Managed@456", 401);
    return "create, update, password review, deactivate, reactivate, delete, super admin assignment, admin limit";
  });

  await check("Notification permissions and replies work by role", async () => {
    const adminMessage = await request("/notifications", {
      method: "POST",
      token: sessions.admin.token,
      body: {
        target: "u-employee",
        title: "Invoice correction required",
        message: "Please review the payment amount before resubmitting.",
      },
    });
    expect(adminMessage.response.status === 201, "Admin notification send failed", JSON.stringify(adminMessage.payload));
    const sentNotification = adminMessage.payload.notifications?.[0];
    expect(sentNotification?.recipientId === "u-employee", "Admin notification was not addressed to the employee");

    const employeeInbox = await request("/notifications", { token: sessions.employee.token });
    expect(employeeInbox.response.ok, "Employee notifications failed");
    const received = employeeInbox.payload.notifications?.find((item) => item.id === sentNotification.id);
    expect(received?.unread === true && received.direction === "received", "Employee did not receive unread notification");

    const employeeSend = await request("/notifications", {
      method: "POST",
      token: sessions.employee.token,
      body: {
        target: "u-admin-regular",
        title: "Employee direct message",
        message: "This should be blocked.",
      },
    });
    expect(employeeSend.response.status === 403, "Employee should not create new notifications");

    const reply = await request(`/notifications/${received.id}/reply`, {
      method: "POST",
      token: sessions.employee.token,
      body: { message: "I will correct and resubmit the entry." },
    });
    expect(reply.response.status === 201, "Employee reply failed", JSON.stringify(reply.payload));
    expect(reply.payload.notification?.recipientId === sessions.admin.user.id, "Reply should return to the original sender");

    const adminInbox = await request("/notifications", { token: sessions.admin.token });
    expect(
      adminInbox.payload.notifications?.some((item) => item.parentId === received.id && item.direction === "received"),
      "Admin did not receive employee reply",
    );

    const markRead = await request(`/notifications/${received.id}/read`, {
      method: "PATCH",
      token: sessions.employee.token,
    });
    expect(markRead.response.ok && markRead.payload.notification?.unread === false, "Mark notification read failed");

    const broadcast = await request("/notifications", {
      method: "POST",
      token: sessions.superAdmin.token,
      body: {
        target: "all",
        title: "System broadcast",
        message: "This message verifies super admin broadcasting.",
      },
    });
    expect(broadcast.response.status === 201, "Super admin broadcast failed", JSON.stringify(broadcast.payload));
    expect(broadcast.payload.notifications?.length >= 2, "Broadcast should reach multiple users");
    return "admin/super admin send, employee reply only";
  });

  await check("Logout invalidates protected API access", async () => {
    const logout = await request("/auth/logout", {
      method: "POST",
      token: sessions.admin.token,
    });
    expect(logout.response.ok && logout.payload.ok === true, "Logout endpoint failed");

    const meAfterLogout = await request("/auth/me", { token: sessions.admin.token });
    expect(meAfterLogout.response.status === 401, "Logged-out token should not access /auth/me");
    const invoicesAfterLogout = await request("/invoices", { token: sessions.admin.token });
    expect(invoicesAfterLogout.response.status === 401, "Logged-out token should not access protected records");
    return "session closed";
  });

  console.log(`\nE2E CHECK COMPLETE: ${results.length} checks passed.`);
} finally {
  await stopServer();
  await resetDemoData();
}
