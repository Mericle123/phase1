import { 
  ArrowLeft, ArrowRight, TrendingUp, DollarSign, Activity, 
  FileText, ShieldCheck, User
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
} from 'recharts';
import { cn } from "../lib/utils";
import { ChartFrame } from "./ChartFrame";

const MetricCard = ({ title, value, subtext, icon: Icon, trend = "up", trendValue }) => (
  <div className="premium-card premium-card-hover p-6 rounded-[1.35rem] flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <div className="metric-icon p-3 bg-indigo-50 rounded-xl text-indigo-600">
        <Icon size={20} />
      </div>
      <span className={cn(
        "text-xs font-bold px-2 py-1 rounded-md",
        trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
      )}>
        {trend === 'up' ? '↑' : '↓'} {trendValue}%
      </span>
    </div>
    <div>
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</h3>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-black text-slate-900">{value}</span>
      </div>
      <p className="text-[10px] text-slate-400 mt-1 font-medium">{subtext}</p>
    </div>
  </div>
);

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const calculateFinancials = (client) => {
  const amount = Math.max(1, toNumber(client.invoiceAmount, toNumber(client.amount, 1)));
  const financialData = client.financialData || {};
  const debtPercent = Math.min(95, Math.max(0, toNumber(financialData.debtPercent, client.category === "Foreigner" ? 45 : 30)));
  const equityPercent = Math.min(100, Math.max(5, toNumber(financialData.equityPercent, 100 - debtPercent)));
  
  const projections = [
    { name: '2022', Revenue: amount * 0.8, Costs: amount * 0.6, NetIncome: amount * 0.2 },
    { name: '2023', Revenue: amount * 0.95, Costs: amount * 0.7, NetIncome: amount * 0.25 },
    { name: '2024', Revenue: amount * 1.1, Costs: amount * 0.75, NetIncome: amount * 0.35 },
    { name: '2025', Revenue: amount * 1.4, Costs: amount * 0.9, NetIncome: amount * 0.5 },
    { name: '2026', Revenue: amount * 1.8, Costs: amount * 1.1, NetIncome: amount * 0.7 },
  ];

  const estimatedROI = Number.isFinite(projections[4].NetIncome / amount)
    ? ((projections[4].NetIncome / amount) * 100).toFixed(1)
    : "0.0";
  const riskLevel = amount > 5000000 ? "Medium" : "Low";
  const debtEquityRatio = (debtPercent / equityPercent).toFixed(2);
  const totalAssets = amount * 1.5;
  const totalLiabilities = amount * (debtPercent / 100);
  const netWorth = totalAssets - totalLiabilities;
  const unsecuredDebt = totalLiabilities * 0.2;

  const depreciationSchedule = Array.from({ length: 6 }).map((_, i) => {
    const year = 2024 + i;
    const opening = amount * Math.pow(0.85, i);
    const depreciation = opening * 0.15;
    const closing = opening - depreciation;
    return { year, opening: Math.round(opening), depreciation: Math.round(depreciation), closing: Math.round(closing) };
  });

  return {
    debtPercent, equityPercent, projections, estimatedROI, riskLevel,
    debtEquityRatio, unsecuredDebt, totalAssets, totalLiabilities, netWorth,
    depreciationSchedule
  };
};

export function FinancialReport({ client, onBack, onViewDetails }) {
  if (!client) return null;

  const finData = calculateFinancials(client);

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 relative">
      <div className="sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 bg-white hover:bg-slate-900 hover:text-white rounded-xl transition-all border border-slate-200 shadow-lg active:scale-95 text-slate-600 group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Financial Analysis
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[8px] uppercase font-black rounded border border-indigo-100">Live Report</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{client.name} | Cycle 2026</p>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto pb-20 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard title="Total Allocation" value={`Nu. ${client.amount}`} subtext="Total capital deployed" icon={DollarSign} trendValue={5.2} />
          <MetricCard title="Projected Yield" value={`${finData.estimatedROI}%`} subtext="Annualized ROI" icon={TrendingUp} trendValue={1.4} />
          <MetricCard title="Risk Rating" value={finData.riskLevel} subtext="System verified" icon={Activity} trendValue={finData.debtPercent} />
          <MetricCard title="Audited Docs" value={`${client.auditStatus?.docs?.length || 0}/4`} subtext="Verification status" icon={FileText} trendValue={100} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="premium-card p-8 rounded-[1.35rem]">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Growth Trajectory</h2>
              <ChartFrame className="h-72 min-h-[18rem] min-w-0 w-full">
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={finData.projections}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="Revenue" fill="#001A70" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="NetIncome" fill="#1D7BBE" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ChartFrame>
            </div>

            <div className="premium-card p-8 rounded-[1.35rem] overflow-hidden">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                Depreciation Schedule
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4 border-b border-slate-200">Year</th>
                      <th className="px-6 py-4 border-b border-slate-200 text-right">Opening</th>
                      <th className="px-6 py-4 border-b border-slate-200 text-right">Depreciation</th>
                      <th className="px-6 py-4 border-b border-slate-200 text-right">Closing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {finData.depreciationSchedule.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors text-xs">
                        <td className="px-6 py-4 font-black text-slate-900">{row.year}</td>
                        <td className="px-6 py-4 text-right font-mono text-slate-600">Nu. {row.opening.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-mono text-rose-600 font-bold">-{row.depreciation.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-mono font-black text-slate-900">Nu. {row.closing.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="premium-card p-8 rounded-[1.35rem]">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Asset Standing</h2>
              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>Total Assets</span>
                  <span className="text-slate-900">Nu. {Math.round(finData.totalAssets).toLocaleString()}</span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 uppercase">Net Worth</span>
                  <span className="text-lg font-black text-indigo-600">Nu. {Math.round(finData.netWorth).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="premium-dark-panel p-8 rounded-[1.35rem] text-white relative overflow-hidden">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Account Status</h2>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                  <span className="text-xl font-black">A+</span>
                </div>
                <p className="text-lg font-bold">Verified Qualified</p>
              </div>
              <div className="absolute right-[-30px] bottom-[-30px] opacity-10">
                <ShieldCheck size={180} />
              </div>
            </div>

            <button onClick={() => onViewDetails(client)} className="w-full premium-card premium-card-hover p-6 rounded-[1.35rem] flex items-center justify-between group transition-all">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-900 text-white rounded-2xl group-hover:scale-110 transition-all">
                  <User size={24} />
                </div>
                <span className="font-bold">Client Details</span>
              </div>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
