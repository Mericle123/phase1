import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

export function ChartFrame({ children, className }) {
  const frameRef = useRef(null);
  const [dimensions, setDimensions] = useState(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const update = () => {
      const rect = frame.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height)),
        });
      }
    };

    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(frame);
    const animationFrame = requestAnimationFrame(update);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div ref={frameRef} className={cn("min-w-0", className)}>
      {dimensions ? (typeof children === "function" ? children(dimensions) : children) : (
        <div className="flex h-full min-h-[12rem] items-center justify-center rounded-lg border border-[var(--ct-line)] bg-white/55 text-xs font-black uppercase tracking-widest text-slate-400">
          Preparing chart
        </div>
      )}
    </div>
  );
}
