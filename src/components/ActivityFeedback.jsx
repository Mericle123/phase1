import { useEffect, useRef, useState } from "react";
import { TaskLoader } from "./TaskLoader";

const minimumVisibleMs = 420;

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
    return () => {
      window.removeEventListener("nz:activity", handleActivity);
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
