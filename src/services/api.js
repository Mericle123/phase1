const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:4178/api";
const TOKEN_KEY = "counttale_token";

let authToken = localStorage.getItem(TOKEN_KEY) || "";

const activityTypeFor = (path, method = "GET") => {
  if (path.includes("/auth/login")) return "login";
  if (path.includes("/auth/password")) return "profile";
  if (path.includes("/employee-timing")) return "timing";
  if (path.includes("/employee-activity")) return "activity";
  if (path.includes("/notifications")) return "message";
  if (path.includes("/reports")) return "report";
  if (path.includes("/users")) return "user";
  if (path.includes("/blockchain") || path.includes("/review")) return "verify";
  if (path.includes("/status")) return "payment";
  if (path.includes("/invoices") && method === "POST") return "invoice";
  if (path.includes("/invoices") && method === "PATCH") return "invoice";
  if (path.includes("/invoices")) return "record";
  return "workspace";
};

const dispatchActivity = (detail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("nz:activity", { detail }));
};

const request = async (path, options = {}) => {
  const { silentLoading = false, activityType, ...requestOptions } = options;
  const headers = {
    "Content-Type": "application/json",
    ...(requestOptions.headers || {}),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const activity = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: activityType || activityTypeFor(path, requestOptions.method),
    phase: "start",
  };
  if (!silentLoading) dispatchActivity(activity);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...requestOptions,
      headers,
    });

    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    payload ||= {};

    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }

    return payload;
  } finally {
    if (!silentLoading) dispatchActivity({ ...activity, phase: "finish" });
  }
};

export const api = {
  get token() {
    return authToken;
  },
  setToken(token) {
    authToken = token || "";
    if (authToken) localStorage.setItem(TOKEN_KEY, authToken);
    else localStorage.removeItem(TOKEN_KEY);
  },
  async login(email, password) {
    const payload = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(payload.token);
    return payload;
  },
  logout() {
    const logoutRequest = authToken
      ? request("/auth/logout", { method: "POST" }).catch(() => {})
      : Promise.resolve();
    this.setToken("");
    return logoutRequest;
  },
  me() {
    return request("/auth/me");
  },
  changePassword(data) {
    return request("/auth/password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  health() {
    return request("/health");
  },
  users() {
    return request("/users");
  },
  createUser(data) {
    return request("/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateUser(id, data) {
    return request(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  deleteUser(id) {
    return request(`/users/${id}`, {
      method: "DELETE",
    });
  },
  notifications(options = {}) {
    return request("/notifications", options);
  },
  notificationRecipients() {
    return request("/notifications/recipients");
  },
  sendNotification(data) {
    return request("/notifications", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  markNotificationRead(id) {
    return request(`/notifications/${id}/read`, {
      method: "PATCH",
    });
  },
  replyNotification(id, data) {
    return request(`/notifications/${id}/reply`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  invoices(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    );
    return request(`/invoices${query.toString() ? `?${query}` : ""}`);
  },
  invoice(id) {
    return request(`/invoices/${id}`);
  },
  createInvoice(data) {
    return request("/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateInvoice(id, data) {
    return request(`/invoices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  updateStatus(id, data) {
    return request(`/invoices/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  reviewInvoice(id, data) {
    return request(`/invoices/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  createCorrection(id, data) {
    return request(`/invoices/${id}/corrections`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  checkJournal(journalNo, excludeId = "") {
    const query = excludeId ? `?excludeId=${encodeURIComponent(excludeId)}` : "";
    return request(`/journals/${encodeURIComponent(journalNo)}/check${query}`);
  },
  reportStatus() {
    return request("/reports/status");
  },
  employeeActivity(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    );
    return request(`/employee-activity${query.toString() ? `?${query}` : ""}`);
  },
  employeeActivitySummary(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    );
    return request(`/employee-activity/summary${query.toString() ? `?${query}` : ""}`);
  },
  employeeTiming(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    );
    return request(`/employee-timing${query.toString() ? `?${query}` : ""}`);
  },
  saveTimingException(data) {
    return request("/employee-timing/exceptions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  removeTimingException(data) {
    return request("/employee-timing/exceptions", {
      method: "DELETE",
      body: JSON.stringify(data),
    });
  },
  blockchain(journalNo) {
    return request(`/blockchain/${encodeURIComponent(journalNo)}`);
  },
};
