import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, MessageSquareReply, Search, Send, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { api } from "../services/api";
import { TaskLoader } from "./TaskLoader";

const canCompose = (user) => ["super_admin", "admin", "verifier"].includes(user?.role);

const formatTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.16);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
  } catch {
    // Browsers may block sound until the user interacts with the page.
  }
};

export function NotificationCenter({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [recipients, setRecipients] = useState({ groups: [], users: [] });
  const [messageForm, setMessageForm] = useState({ target: "", title: "", message: "" });
  const [recipientSearch, setRecipientSearch] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});
  const [isSending, setIsSending] = useState(false);
  const hasLoadedOnce = useRef(false);
  const previousUnreadCount = useRef(0);

  const unreadCount = notifications.filter((item) => item.unread).length;

  const loadNotifications = useCallback(async ({ quiet = false } = {}) => {
    try {
      const payload = await api.notifications({ silentLoading: quiet });
      const nextNotifications = payload.notifications || [];
      const nextUnread = nextNotifications.filter((item) => item.unread).length;
      if (hasLoadedOnce.current && nextUnread > previousUnreadCount.current) {
        playNotificationSound();
        if (!quiet) toast.info("New notification received");
      }
      previousUnreadCount.current = nextUnread;
      hasLoadedOnce.current = true;
      setNotifications(nextNotifications);
    } catch (error) {
      if (!quiet) toast.error("Could not load notifications", { description: error.message });
    }
  }, []);

  const loadRecipients = useCallback(async () => {
    if (!canCompose(user)) return;
    try {
      const payload = await api.notificationRecipients();
      setRecipients({
        groups: payload.groups || [],
        users: payload.users || [],
      });
      const firstTarget = payload.groups?.[0]?.id || payload.users?.[0]?.id || "";
      setMessageForm((current) => ({ ...current, target: current.target || firstTarget }));
    } catch (error) {
      toast.error("Could not load recipients", { description: error.message });
    }
  }, [user]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void loadNotifications({ quiet: true });
      void loadRecipients();
    }, 0);
    const timer = window.setInterval(() => {
      void loadNotifications({ quiet: true });
    }, 10000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [loadNotifications, loadRecipients]);

  const markRead = async (notification) => {
    if (!notification.unread) return;
    try {
      const { notification: updated } = await api.markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      toast.error("Could not mark notification read", { description: error.message });
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    setIsSending(true);
    try {
      const payload = await api.sendNotification(messageForm);
      setNotifications((current) => [...(payload.notifications || []), ...current]);
      setMessageForm((current) => ({ ...current, title: "", message: "" }));
      toast.success("Notification sent");
    } catch (error) {
      toast.error("Message failed", { description: error.message });
    } finally {
      setIsSending(false);
    }
  };

  const sendReply = async (notification) => {
    const message = String(replyDrafts[notification.id] || "").trim();
    if (!message) {
      toast.error("Reply required", { description: "Write a short reply before sending." });
      return;
    }
    try {
      const { notification: reply } = await api.replyNotification(notification.id, { message });
      setNotifications((current) => [reply, ...current.map((item) => (item.id === notification.id ? { ...item, unread: false, readAt: item.readAt || new Date().toISOString() } : item))]);
      setReplyDrafts((current) => ({ ...current, [notification.id]: "" }));
      toast.success("Reply sent");
    } catch (error) {
      toast.error("Reply failed", { description: error.message });
    }
  };

  const recipientOptions = [
    ...recipients.groups.map((item) => ({ ...item, type: "Group" })),
    ...recipients.users.map((item) => ({ id: item.id, label: `${item.name} (${item.roleLabel})`, type: "User" })),
  ];
  const filteredRecipientOptions = recipientOptions.filter((item) =>
    `${item.label} ${item.type}`.toLowerCase().includes(recipientSearch.toLowerCase().trim()),
  );
  const selectedRecipient = recipientOptions.find((item) => item.id === messageForm.target);

  const panel = isOpen ? createPortal(
    <>
      <div className="notification-backdrop fixed inset-0 z-[230] bg-slate-950/20" onClick={() => setIsOpen(false)} />
      <aside className="notification-panel fixed right-0 top-0 z-[240] flex h-full w-[min(29rem,100vw)] flex-col border-l border-white/80 shadow-2xl shadow-slate-400/30 backdrop-blur-2xl motion-drawer">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-navy)]">Message Center</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Notifications</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">{unreadCount} unread message{unreadCount === 1 ? "" : "s"}</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="ui-icon-btn" aria-label="Close notifications">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {canCompose(user) && (
            <form onSubmit={sendMessage} className="mb-5 rounded-[1.35rem] border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-[var(--ds-navy)]">
                <Send size={15} />
                <p className="text-xs font-black uppercase tracking-widest">Send Notification</p>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-emerald-100 bg-white/70 p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      value={recipientSearch}
                      onChange={(event) => setRecipientSearch(event.target.value)}
                      className="premium-input w-full rounded-2xl py-2.5 pl-9 pr-3 text-xs font-bold text-slate-900 outline-none"
                      placeholder="Search employee, admin, or group..."
                    />
                  </div>
                  <div className="mt-3 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                    <div className="grid grid-cols-1 gap-2">
                      {filteredRecipientOptions.map((item) => {
                        const selected = messageForm.target === item.id;
                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            type="button"
                            onClick={() => setMessageForm((current) => ({ ...current, target: item.id }))}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                              selected ? "notification-recipient-selected text-[var(--ds-navy)]" : "border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-black">{item.label}</span>
                              <span className="mt-0.5 block text-[10px] font-black uppercase tracking-widest opacity-60">{item.type}</span>
                            </span>
                            {selected && <CheckCheck size={14} />}
                          </button>
                        );
                      })}
                      {!filteredRecipientOptions.length && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-4 text-center text-xs font-bold text-slate-500">
                          No matching recipients.
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Sending to: <span className="text-slate-700">{selectedRecipient?.label || "Choose recipient"}</span>
                  </p>
                </div>
                <input
                  value={messageForm.title}
                  onChange={(event) => setMessageForm((current) => ({ ...current, title: event.target.value }))}
                  className="premium-input rounded-2xl px-3 py-3 text-xs font-bold text-slate-900 outline-none"
                  placeholder="Subject"
                />
                <textarea
                  value={messageForm.message}
                  onChange={(event) => setMessageForm((current) => ({ ...current, message: event.target.value }))}
                  className="premium-input min-h-24 rounded-2xl px-3 py-3 text-sm font-medium text-slate-900 outline-none resize-none"
                  placeholder="Write the correction, reminder, or instruction..."
                  required
                />
                <button type="submit" disabled={isSending || !messageForm.target} className="ui-btn ui-btn-md ui-btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-50">
                  <Send size={16} />
                  {isSending ? <TaskLoader type="message" compact className="notification-inline-loader" /> : "Send Message"}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={cn(
                  "notification-item rounded-[1.35rem] border p-4 transition-all",
                  notification.unread ? "border-rose-100 bg-rose-50/80" : "border-slate-100 bg-white/75",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {notification.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-600 shadow-[0_0_0_4px_rgba(225,38,27,0.12)]" />}
                      <p className="truncate text-sm font-black text-slate-950">{notification.title}</p>
                    </div>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {notification.direction === "sent" ? `To ${notification.recipientName}` : `From ${notification.senderName}`} / {formatTime(notification.createdAt)}
                    </p>
                  </div>
                  {notification.unread && (
                    <button type="button" onClick={() => markRead(notification)} className="ui-icon-btn text-emerald-700" aria-label="Mark notification read">
                      <CheckCheck size={15} />
                    </button>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">{notification.message}</p>
                {notification.direction === "received" && (
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-white/70 p-3">
                    <div className="mb-2 flex items-center gap-2 text-slate-500">
                      <MessageSquareReply size={14} />
                      <p className="text-[10px] font-black uppercase tracking-widest">Reply</p>
                    </div>
                    <textarea
                      value={replyDrafts[notification.id] || ""}
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [notification.id]: event.target.value }))}
                      className="premium-input min-h-20 w-full rounded-2xl px-3 py-2 text-sm outline-none resize-none"
                      placeholder="Reply to sender..."
                      onFocus={() => markRead(notification)}
                    />
                    <button type="button" onClick={() => sendReply(notification)} className="ui-btn ui-btn-sm ui-btn-secondary mt-2 w-full justify-center">
                      Send Reply
                    </button>
                  </div>
                )}
              </article>
            ))}
            {notifications.length === 0 && (
              <div className="rounded-[1.35rem] border border-slate-100 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
                No notifications yet.
              </div>
            )}
          </div>
        </div>
      </aside>
    </>,
    document.body,
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          void loadNotifications({ quiet: true });
        }}
        className="relative p-2 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95"
        aria-label="Open notifications"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600" />
          </span>
        )}
      </button>
      {panel}
    </>
  );
}
