import { useEffect, useRef, useState } from "react";
import { TaskLoader } from "./TaskLoader";

const minimumVisibleMs = 420;

const getInteractionType = (control) => {
  const explicitType = control.dataset.loadingType;
  if (explicitType) return explicitType;

  const label = [control.textContent, control.getAttribute("aria-label"), control.getAttribute("title")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/message|reply|send/.test(label)) return "message";
  if (/invoice|journal|draft|record/.test(label)) return "invoice";
  if (/payment|balance|paid|status/.test(label)) return "payment";
  if (/report|analysis|export|download/.test(label)) return "report";
  if (/timing|attendance|arrival|late/.test(label)) return "timing";
  if (/employee|user|account|admin/.test(label)) return "user";
  if (/verify|review|approve|confirm/.test(label)) return "verify";
  if (/profile|password|setting/.test(label)) return "profile";
  return "interaction";
};

export function ActivityFeedback() {
  const activeRequests = useRef(new Map());
  const hideTimer = useRef(null);
  const startedAt = useRef(0);
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    };

    const handleActivity = (event) => {
      const detail = event.detail || {};
      if (!detail.id) return;

      if (detail.phase === "start") {
        clearHideTimer();
        activeRequests.current.set(detail.id, detail);
        startedAt.current = Date.now();
        setActivity(detail);
        return;
      }

      activeRequests.current.delete(detail.id);
      if (activeRequests.current.size) {
        setActivity([...activeRequests.current.values()].at(-1));
        return;
      }

      const wait = Math.max(0, minimumVisibleMs - (Date.now() - startedAt.current));
      hideTimer.current = window.setTimeout(() => setActivity(null), wait);
    };

    window.addEventListener("nz:activity", handleActivity);
    const handleInteraction = (event) => {
      const control = event.target.closest?.("button, a[href], [role='button'], [role='tab']");
      if (
        !control ||
        control.disabled ||
        control.getAttribute("aria-disabled") === "true" ||
        control.closest(".activity-feedback, .task-loader, [data-loading-feedback='off']")
      ) return;

      const id = `interaction-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.dispatchEvent(new CustomEvent("nz:activity", {
        detail: { id, phase: "start", type: getInteractionType(control) },
      }));
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("nz:activity", { detail: { id, phase: "finish" } }));
      }, minimumVisibleMs);
    };
    document.addEventListener("click", handleInteraction, true);
    return () => {
      window.removeEventListener("nz:activity", handleActivity);
      document.removeEventListener("click", handleInteraction, true);
      clearHideTimer();
    };
  }, []);

  if (!activity) return null;

  return (
    <div className="activity-feedback" aria-live="polite" aria-atomic="true">
      <TaskLoader type={activity.type || "workspace"} compact className="activity-feedback-loader" />
    </div>
  );
}
