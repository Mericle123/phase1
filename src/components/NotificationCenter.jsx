import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, Inbox, MailPlus, MessageSquareReply, Search, Send, Users, X } from "lucide-react";
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
  const [activeView, setActiveView] = useState("inbox");
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

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

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
      setActiveView("inbox");
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
    <div className="message-center-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
      <section
        className="message-center-dialog motion-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-center-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="message-center-header">
          <div className="message-center-title-group">
            <span className="message-center-mark"><Bell size={20} /></span>
            <div>
              <p>Communication Center</p>
              <h2 id="message-center-title">Messages & Notifications</h2>
              <span>{unreadCount} unread message{unreadCount === 1 ? "" : "s"}</span>
            </div>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="ui-icon-btn" aria-label="Close notifications">
            <X size={18} />
          </button>
        </header>

        <nav className="message-center-tabs" aria-label="Message center views">
          <button type="button" className={activeView === "inbox" ? "is-active" : ""} onClick={() => setActiveView("inbox")}>
            <Inbox size={16} />
            Inbox
            {unreadCount > 0 && <span>{unreadCount}</span>}
          </button>
          {canCompose(user) && (
            <button type="button" className={activeView === "compose" ? "is-active" : ""} onClick={() => setActiveView("compose")}>
              <MailPlus size={16} />
              New Message
            </button>
          )}
        </nav>

        <div className="message-center-body custom-scrollbar">
          {activeView === "compose" && canCompose(user) ? (
            <form onSubmit={sendMessage} className="message-compose-layout">
              <aside className="message-recipient-pane">
                <div className="message-section-heading">
                  <Users size={17} />
                  <div>
                    <h3>Recipients</h3>
                    <p>Choose a person or permitted group</p>
                  </div>
                </div>
                <label className="message-recipient-search">
                  <Search size={15} aria-hidden="true" />
                  <span className="sr-only">Search recipients</span>
                  <input
                    value={recipientSearch}
                    onChange={(event) => setRecipientSearch(event.target.value)}
                    placeholder="Search recipients"
                  />
                </label>
                <div className="message-recipient-list custom-scrollbar">
                  {filteredRecipientOptions.map((item) => {
                    const selected = messageForm.target === item.id;
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => setMessageForm((current) => ({ ...current, target: item.id }))}
                        className={cn("message-recipient-option", selected && "is-selected")}
                      >
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.type}</small>
                        </span>
                        {selected && <CheckCheck size={16} />}
                      </button>
                    );
                  })}
                  {!filteredRecipientOptions.length && <p className="message-empty-recipient">No matching recipients.</p>}
                </div>
              </aside>

              <div className="message-editor-pane">
                <div className="message-section-heading">
                  <Send size={17} />
                  <div>
                    <h3>Compose Message</h3>
                    <p>To {selectedRecipient?.label || "select a recipient"}</p>
                  </div>
                </div>
                <label className="message-editor-field">
                  <span>Subject</span>
                  <input
                    value={messageForm.title}
                    onChange={(event) => setMessageForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="What is this message about?"
                    required
                  />
                </label>
                <label className="message-editor-field message-editor-grow">
                  <span>Message</span>
                  <textarea
                    value={messageForm.message}
                    onChange={(event) => setMessageForm((current) => ({ ...current, message: event.target.value }))}
                    placeholder="Write a clear correction, reminder, or instruction..."
                    maxLength={1200}
                    required
                  />
                  <small>{messageForm.message.length}/1200</small>
                </label>
                <div className="message-editor-actions">
                  <button type="button" onClick={() => setActiveView("inbox")} className="ui-btn ui-btn-md ui-btn-secondary">Cancel</button>
                  <button type="submit" disabled={isSending || !messageForm.target} className="ui-btn ui-btn-md ui-btn-primary">
                    {isSending ? <TaskLoader type="message" compact className="notification-inline-loader" /> : <><Send size={16} />Send Message</>}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="message-inbox-list">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={cn(
                  "message-inbox-item",
                  notification.unread && "is-unread",
                )}
              >
                <div className="message-inbox-topline">
                  <div>
                    <span className="message-direction">{notification.direction === "sent" ? "Sent" : "Received"}</span>
                    <h3>{notification.title}</h3>
                    <p>{notification.direction === "sent" ? `To ${notification.recipientName}` : `From ${notification.senderName}`} · {formatTime(notification.createdAt)}</p>
                  </div>
                  {notification.unread && (
                    <button type="button" onClick={() => markRead(notification)} className="ui-icon-btn" aria-label="Mark notification read" title="Mark as read">
                      <CheckCheck size={15} />
                    </button>
                  )}
                </div>
                <p className="message-inbox-copy">{notification.message}</p>
                {notification.direction === "received" && (
                  <div className="message-reply-box">
                    <div className="message-reply-label">
                      <MessageSquareReply size={14} />
                      <span>Reply</span>
                    </div>
                    <textarea
                      value={replyDrafts[notification.id] || ""}
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [notification.id]: event.target.value }))}
                      placeholder="Reply to sender..."
                      onFocus={() => markRead(notification)}
                    />
                    <button type="button" onClick={() => sendReply(notification)} className="ui-btn ui-btn-sm ui-btn-secondary">
                      Send Reply
                    </button>
                  </div>
                )}
              </article>
            ))}
            {notifications.length === 0 && (
              <div className="message-inbox-empty">
                <Inbox size={28} />
                <h3>Your inbox is clear</h3>
                <p>New messages and important account notifications will appear here.</p>
              </div>
            )}
          </div>
          )}
        </div>
      </section>
    </div>,
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
