import { cn } from "../lib/utils";

export function StatCard({ title, value, subtext, icon: Icon, colorClass, trend, actionNode }) {
  return (
    <div className="ct-stat-card premium-card premium-card-hover p-5 flex flex-col gap-4 relative overflow-hidden">
      <div className="ct-card-trace" />
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-black text-[var(--ct-muted)] uppercase tracking-widest">{title}</p>
            {actionNode}
          </div>
          <h3 className="text-4xl font-black text-[var(--ct-ink)] mt-2 tracking-tight">{value}</h3>
          <p className={cn("text-xs mt-2 flex items-center gap-1", trend === 'danger' ? 'text-rose-500' : 'text-slate-500')}>
            {subtext}
          </p>
        </div>
        <div className={cn("ct-stat-icon flex items-center justify-center", colorClass)}>
          <Icon size={20} className="stroke-[2.5px]" />
        </div>

      </div>
    </div>
  );
}
