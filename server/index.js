import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  attachBlockchainCommit,
  createCorrection,
  createInvoice,
  createUser,
  createUserSession,
  changeOwnPassword,
  deleteUser,
  findUserByEmail,
  findUserById,
  getEmployeeActivityReport,
  getEmployeeTimingReport,
  getInvoiceById,
  getStatusReport,
  getStorageInfo,
  initStore,
  invalidateUserSession,
  isUserSessionActive,
  journalExists,
  listEmployeeActivities,
  listInvoices,
  listNotificationRecipients,
  listNotifications,
  listUsers,
  markNotificationRead,
  publicUser,
  replyToNotification,
  removeTimingException,
  touchUserSession,
  updateAdminReview,
  createNotification,
  updateInvoice,
  updatePaymentStatus,
  updateUser,
  upsertTimingException,
} from "./services/store.js";
import { commitPaidInvoice, fabricMode, queryPaidInvoice } from "./services/blockchain.js";

const app = express();
const port = Number(process.env.API_PORT || 4178);
const host = process.env.API_HOST || "127.0.0.1";
const jwtSecret = process.env.JWT_SECRET || "counttale-local-development-secret";

app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const signToken = (user, sessionId) =>
  jwt.sign({ sub: user.id, role: user.role, sid: sessionId }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });

const requestContext = (req) => ({
  ipAddress: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "")
    .split(",")[0]
    .trim(),
  userAgent: req.headers["user-agent"] || "",
  locationPermission: req.headers["x-location-permission"] || "",
  sessionId: req.sessionId || "",
});

const asyncRoute = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = findUserById(payload.sub);
    if (!user || user.active === false) {
      return res.status(401).json({ error: "Account is inactive or no longer exists." });
    }
    if (!isUserSessionActive(payload.sid, payload.sub)) {
      return res.status(401).json({ error: "Session has been logged out or expired." });
    }
    req.sessionId = payload.sid || "";
    req.user = publicUser(user);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session." });
  }
};

const requireRoles = (...roles) => (req, res, next) => {
  if (req.user.role === "super_admin" && roles.includes("admin")) {
    return next();
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "You do not have permission to perform this action." });
  }
  next();
};

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "CountTale Invoice Management API",
    storage: getStorageInfo(),
    blockchain: fabricMode(),
  });
});

app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const { email, password } = req.body || {};
    const user = findUserByEmail(email);
    if (!user || user.active === false) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const valid = await bcrypt.compare(String(password || ""), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const session = await createUserSession(user, requestContext(req));
    res.json({ token: signToken(user, session.id), user: publicUser(user), session });
  }),
);

app.get("/api/auth/me", requireAuth, asyncRoute(async (req, res) => {
  await touchUserSession(req.user, requestContext(req));
  res.json({ user: req.user });
}));

app.post("/api/auth/password", requireAuth, asyncRoute(async (req, res) => {
  const user = await changeOwnPassword(req.body, req.user, requestContext(req));
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user });
}));

app.post("/api/auth/logout", requireAuth, asyncRoute(async (req, res) => {
  await invalidateUserSession(req.sessionId, req.user, requestContext(req));
  res.json({ ok: true });
}));

app.get("/api/users", requireAuth, requireRoles("admin"), (_req, res) => {
  res.json({ users: listUsers() });
});

app.post(
  "/api/users",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (req, res) => {
    const user = await createUser(req.body, req.user, requestContext(req));
    res.status(201).json({ user });
  }),
);

app.patch(
  "/api/users/:id",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (req, res) => {
    const user = await updateUser(req.params.id, req.body, req.user, requestContext(req));
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  }),
);

app.delete(
  "/api/users/:id",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (req, res) => {
    const user = await deleteUser(req.params.id, req.user, requestContext(req));
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user });
  }),
);

app.get("/api/notifications", requireAuth, (req, res) => {
  res.json({ notifications: listNotifications(req.user) });
});

app.get("/api/notifications/recipients", requireAuth, (req, res) => {
  res.json(listNotificationRecipients(req.user));
});

app.post(
  "/api/notifications",
  requireAuth,
  asyncRoute(async (req, res) => {
    const notifications = await createNotification(req.body, req.user, requestContext(req));
    res.status(201).json({ notifications });
  }),
);

app.patch(
  "/api/notifications/:id/read",
  requireAuth,
  asyncRoute(async (req, res) => {
    const notification = await markNotificationRead(req.params.id, req.user, requestContext(req));
    if (!notification) return res.status(404).json({ error: "Notification not found." });
    res.json({ notification });
  }),
);

app.post(
  "/api/notifications/:id/reply",
  requireAuth,
  asyncRoute(async (req, res) => {
    const notification = await replyToNotification(req.params.id, req.body, req.user, requestContext(req));
    if (!notification) return res.status(404).json({ error: "Notification not found." });
    res.status(201).json({ notification });
  }),
);

app.get("/api/journals/:journalNo/check", requireAuth, (req, res) => {
  res.json({
    journalNo: req.params.journalNo,
    exists: journalExists(req.params.journalNo, req.query.excludeId || ""),
  });
});

app.get("/api/invoices", requireAuth, (req, res) => {
  res.json({ invoices: listInvoices(req.user, req.query) });
});

app.post(
  "/api/invoices",
  requireAuth,
  requireRoles("employee"),
  asyncRoute(async (req, res) => {
    const invoice = await createInvoice(req.body, req.user, requestContext(req));
    res.status(201).json({ invoice });
  }),
);

app.patch(
  "/api/invoices/:id/review",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (req, res) => {
    const invoice = await updateAdminReview(req.params.id, req.body, req.user, requestContext(req));
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    res.json({ invoice });
  }),
);

app.get("/api/invoices/:id", requireAuth, (req, res) => {
  const invoice = getInvoiceById(req.params.id, req.user);
  if (!invoice) return res.status(404).json({ error: "Invoice not found." });
  res.json({ invoice });
});

app.patch(
  "/api/invoices/:id",
  requireAuth,
  requireRoles("employee", "admin"),
  asyncRoute(async (req, res) => {
    const invoice = await updateInvoice(req.params.id, req.body, req.user, requestContext(req));
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    res.json({ invoice });
  }),
);

app.patch(
  "/api/invoices/:id/status",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (req, res) => {
    let invoice = await updatePaymentStatus(req.params.id, req.body, req.user, requestContext(req));
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });

    if (invoice.paymentStatus === "Paid" && !invoice.blockchain?.transactionId) {
      const commit = await commitPaidInvoice(invoice, req.user);
      invoice = await attachBlockchainCommit(invoice.id, commit, req.user, requestContext(req));
    }

    res.json({ invoice });
  }),
);

app.post(
  "/api/invoices/:id/commit",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (req, res) => {
    const invoice = getInvoiceById(req.params.id, req.user);
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    if (invoice.blockchain?.transactionId) {
      return res.json({ invoice, commit: invoice.blockchain, alreadyCommitted: true });
    }
    const commit = await commitPaidInvoice(invoice, req.user);
    const updatedInvoice = await attachBlockchainCommit(invoice.id, commit, req.user, requestContext(req));
    res.json({ invoice: updatedInvoice, commit });
  }),
);

app.post(
  "/api/invoices/:id/corrections",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (req, res) => {
    const correction = await createCorrection(req.params.id, req.body, req.user, requestContext(req));
    if (!correction) return res.status(404).json({ error: "Invoice not found." });
    res.status(201).json({ correction });
  }),
);

app.get(
  "/api/blockchain/:journalNo",
  requireAuth,
  requireRoles("admin"),
  (req, res) => {
    const result = queryPaidInvoice(req.params.journalNo);
    if (!result) return res.status(404).json({ error: "No paid invoice ledger record found." });
    res.json(result);
  },
);

app.get("/api/employee-activity", requireAuth, requireRoles("admin"), (req, res) => {
  res.json({ activities: listEmployeeActivities(req.query) });
});

app.get("/api/employee-activity/summary", requireAuth, requireRoles("admin"), (req, res) => {
  res.json(getEmployeeActivityReport(req.query));
});

app.get("/api/employee-timing", requireAuth, requireRoles("admin"), (req, res) => {
  res.json(getEmployeeTimingReport(req.query));
});

app.post(
  "/api/employee-timing/exceptions",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (req, res) => {
    const exception = await upsertTimingException(req.body, req.user, requestContext(req));
    res.status(201).json({ exception, report: getEmployeeTimingReport({ date: exception.date }) });
  }),
);

app.delete(
  "/api/employee-timing/exceptions",
  requireAuth,
  requireRoles("admin"),
  asyncRoute(async (req, res) => {
    const exception = await removeTimingException(req.body, req.user, requestContext(req));
    if (!exception) return res.status(404).json({ error: "No active timing exception found for that employee and date." });
    res.json({ exception, report: getEmployeeTimingReport({ date: exception.date }) });
  }),
);

app.get("/api/reports/status", requireAuth, (req, res) => {
  res.json(getStatusReport(req.user));
});

app.use((error, _req, res, next) => {
  void next;
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: error.message || "Unexpected server error." });
});

await initStore();

const server = app.listen(port, host, () => {
  console.log(`CountTale API running on http://${host}:${port}`);
});

globalThis.countTaleApiServer = server;

export { app, server };
