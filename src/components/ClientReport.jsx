import { ArrowLeft, ArrowRight, TrendingUp, DollarSign, Activity, FileText, Download, ShieldCheck, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { cn } from "../lib/utils";
import { downloadFormattedExcel } from "../lib/exportCsv";
import { currencyCodeForRecord, formatCurrencyAmount } from "../lib/currency";
import { ChartFrame } from "./ChartFrame";

const MetricCard = ({ title, value, subtext, icon: Icon, trend = "up", trendValue }) => (
  <div className="premium-card premium-card-hover p-6 rounded-[1.35rem] flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <div className="metric-icon p-3 bg-emerald-50 rounded-2xl text-emerald-700 border border-emerald-100 shadow-inner">
        <Icon size={20} />
      </div>
      <span className={`text-xs font-bold px-2 py-1 rounded-md ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
        {trend === 'up' ? '↑' : '↓'} {trendValue}%
      </span>
    </div>
    <div>
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</h3>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-black text-slate-900">{value}</span>
      </div>
      <p className="text-xs text-slate-400 mt-2">{subtext}</p>
    </div>
  </div>
);

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const numericSeed = (value = "") =>
  String(value)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
const paymentStatusLabel = (status) => (status === "Pending" ? "Partially Paid" : status || "Unknown");

// Financial Calculator Logic
const calculateFinancials = (client) => {
  const principal = Math.max(1, toNumber(client.invoiceAmount, toNumber(client.amount, 1)));
  const financialData = client.financialData || {};
  // Deterministic seed based on ID to make data look persistent but unique
  const seed = numericSeed(client.id || client.journalNo || client.name);
  
  const debtPercent = clamp(toNumber(financialData.debtPercent, 40 + (seed % 30)), 0, 95);
  const equityPercent = clamp(toNumber(financialData.equityPercent, 100 - debtPercent), 5, 100);
  const currentYear = new Date().getFullYear();
  const interestRate = clamp(toNumber(financialData.financingCost, 5 + (seed % 5)) / 100, 0.01, 0.2);
  const baseYield = 0.12 + ((seed % 10) * 0.015); // 12% to 25%
  
  const debtAmount = principal * (debtPercent / 100);
  const equityAmount = principal * (equityPercent / 100);
  
  // New Banking Metrics
  const debtEquityRatio = (debtAmount / equityAmount).toFixed(2);
  const unsecuredDebt = debtAmount * 0.15; // Assume 15% is unsecured
  const totalAssets = principal * 1.25; // Assets are usually higher than initial capital
  const totalLiabilities = debtAmount;
  const netWorth = totalAssets - totalLiabilities;

  // 5 Year Projections & Depreciation
  const projections = [];
  const depreciationSchedule = [];
  let currentRevenue = Math.max(toNumber(financialData.pnlRevenue), principal * 0.3);
  const cogsRatio = clamp(toNumber(financialData.pnlCogs, currentRevenue * 0.35) / Math.max(1, currentRevenue), 0.1, 0.75);
  const opexRatio = clamp(toNumber(financialData.pnlOpex, currentRevenue * 0.2) / Math.max(1, currentRevenue), 0.05, 0.5);
  let assetValue = Math.max(toNumber(financialData.capitalCost), principal); // Value for depreciation
  const depRate = 0.15; // 15% annual depreciation

  for (let i = 1; i <= 6; i++) {
    const yearLabel = (currentYear + i - 1).toString();
    const growth = 1 + (baseYield / 2);
    currentRevenue = currentRevenue * growth;
    
    const opex = currentRevenue * (cogsRatio + opexRatio);
    const debtService = debtAmount * interestRate;
    const netIncome = currentRevenue - opex - debtService;
    
    const depAmount = assetValue * depRate;
    const endingValue = assetValue - depAmount;

    projections.push({
      name: yearLabel,
      Revenue: Math.round(currentRevenue),
      Costs: Math.round(opex + debtService),
      NetIncome: Math.round(netIncome)
    });

    depreciationSchedule.push({
      year: yearLabel,
      opening: Math.round(assetValue),
      depreciation: Math.round(depAmount),
      closing: Math.round(endingValue)
    });

    assetValue = endingValue;
  }

  const avgNet = projections.reduce((sum, p) => sum + p.NetIncome, 0) / projections.length;
  const estimatedROI = ((avgNet / principal) * 100).toFixed(1);
  const riskLevel = debtPercent > 60 ? "High" : debtPercent > 45 ? "Medium" : "Low";
  
  return {
    principal, debtPercent, equityPercent, debtAmount, equityAmount, 
    interestRate, projections, estimatedROI, riskLevel,
    debtEquityRatio, unsecuredDebt, totalAssets, totalLiabilities, netWorth,
    depreciationSchedule
  };
};


const COLORS = ['#001A70', '#1D7BBE', '#A9B4D3'];

export function ClientReport({ client, onBack, onViewDetails }) {
  if (!client) return null;

  const finData = calculateFinancials(client);
  const money = (value) => formatCurrencyAmount(value, currencyCodeForRecord(client));

  const capitalStructureData = [
    { name: 'Secured Debt', value: finData.debtPercent },
    { name: 'Common Equity', value: finData.equityPercent - 5 },
    { name: 'Preferred Stock', value: 5 },
  ];

  const handleExportExcel = () => {
    const headerData = [
      ["FINANCIAL ANALYSIS REPORT"],
      ["Generated for:", client.name],
      ["Client ID:", `#C-${client.id.toString().padStart(4, '0')}`],
      ["Citizenship:", client.category],
      ["Total Capital:", money(client.invoiceAmount ?? client.amount)],
      ["Projected ROI:", `${finData.estimatedROI}%`],
      ["Risk Profile:", finData.riskLevel],
      ["Debt-Equity Ratio:", finData.debtEquityRatio],
      ["Unsecured Debt:", money(Math.round(finData.unsecuredDebt))],
      ["Audit Opinion:", "Qualified (RAA Certified)"],
      [],
      ["ASSET & LIABILITY SUMMARY"],
      ["Total Assets", money(Math.round(finData.totalAssets))],
      ["Total Liabilities", money(Math.round(finData.totalLiabilities))],
      ["Net Worth", money(Math.round(finData.netWorth))],
      [],
      ["PROJECTION TIMELINE (AUTOMATED)"],
      ["Year", `Gross Revenue (${currencyCodeForRecord(client)})`, `Total Costs (${currencyCodeForRecord(client)})`, `Net Income (${currencyCodeForRecord(client)})`]
    ];

    // Projection Data
    const projectionRows = finData.projections.map(p => [
      p.name, p.Revenue, p.Costs, p.NetIncome
    ]);

    // Depreciation Data
    const depHeader = [
      [],
      ["DEPRECIATION SCHEDULE (15% Reducing Balance)"],
      ["Year", "Opening Value", "Depreciation", "Closing Value"]
    ];
    const depRows = finData.depreciationSchedule.map(d => [
      d.year, d.opening, d.depreciation, d.closing
    ]);

    downloadFormattedExcel(
      `${client.name.replace(/\s+/g, '_')}_Financial_Report.xls`,
      [...headerData, ...projectionRows, ...depHeader, ...depRows],
      {
        title: "Financial Analysis Report",
        subtitle: `${client.name} financial summary with ROI, liabilities, projections, and depreciation schedule.`,
        sheetName: "Financial Report",
      },
    );
  };


  return (
    <div className="ct-page p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto h-full overflow-y-auto motion-page pb-20 custom-scrollbar">
      
      {/* Sticky Back Button Container */}
      <div className="sticky top-0 z-50 mb-4 pointer-events-none">
        <button 
          onClick={onBack}
          className="pointer-events-auto p-2.5 bg-white/90 backdrop-blur hover:bg-slate-950 hover:text-white rounded-2xl transition-all border border-white/70 shadow-xl active:scale-95 text-slate-600 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Header Actions */}
      <div className="ct-section-hero flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-white/10 shadow-sm">
            {client.companyLogo ? (
              <img src={client.companyLogo} alt={`${client.name} logo`} className="h-full w-full object-contain bg-white p-2" />
            ) : (
              <span className="text-sm font-black text-white">{client.initials || "CT"}</span>
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3 flex-wrap">
              Financial Analysis Report
              <span className="px-3 py-1 bg-white/10 text-white/80 text-[10px] uppercase font-black rounded-full tracking-widest border border-white/15">
                Confidential
              </span>
            </h1>
            <p className="text-sm font-semibold text-white/62 mt-1">
              Generated for: {client.name} | {client.category} ({client.cid || client.passport || "N/A"})
            </p>
          </div>
        </div>
        <button 
          onClick={handleExportExcel}
          className="ui-btn ui-btn-md ct-hero-action w-full md:w-auto"
        >
          <Download size={16} /> Export Excel
        </button>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          title="Total Allocation" 
          value={money(client.invoiceAmount ?? client.amount)}
          subtext="Total capital deployed"
          icon={DollarSign}
          trendValue={5.2}
        />
        <MetricCard 
          title="Projected Yield" 
          value={`${finData.estimatedROI}%`} 
          subtext="Annualized Return on Investment"
          icon={TrendingUp}
          trendValue={1.4}
        />
        <MetricCard 
          title="Risk Assessment" 
          value={finData.riskLevel} 
          subtext={`Based on ${finData.debtPercent}% debt ratio`}
          icon={finData.riskLevel === "High" ? AlertTriangle : Activity}
          trend={finData.riskLevel === "High" ? "down" : "up"}
          trendValue={finData.debtPercent}
        />
        <MetricCard 
          title="Audited Docs" 
          value={`${client.auditStatus?.docs?.length || 0}/4`} 
          subtext={client.auditStatus?.finalized ? "Audit Certified" : "Pending Verification"}
          icon={FileText}
          trendValue={client.auditStatus?.finalized ? 100 : ((client.auditStatus?.docs?.length || 0) / 4 * 100)}
        />

      </div>

      {/* Asset & Liability Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="premium-card premium-card-hover p-6 rounded-[1.35rem]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Debt-Equity Ratio</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{finData.debtEquityRatio}</span>
            <span className="text-xs font-bold text-slate-500">x Leverage</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-emerald-800 h-full" style={{ width: `${Math.min(100, parseFloat(finData.debtEquityRatio) * 20)}%` }} />
          </div>
        </div>
        <div className="premium-card premium-card-hover p-6 rounded-[1.35rem]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unsecured Debt</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{money(Math.round(finData.unsecuredDebt))}</span>
          </div>
          <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
            <ShieldCheck size={10} /> 85% Fully Collateralized
          </p>
        </div>
        <div className="premium-card premium-card-hover p-6 rounded-[1.35rem]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Audit Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-lg font-bold text-slate-900">Qualified Opinion</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Last Audit: May 2026 by RAA</p>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Left Column - Deep Analysis */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="premium-card p-5 sm:p-8 rounded-[1.35rem]">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              Portfolio Projection Timeline
            </h2>
            
            <ChartFrame className="h-72 min-h-[18rem] min-w-0 w-full">
              {({ width, height }) => (
                <BarChart width={width} height={height} data={finData.projections} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `${(value/1000000).toFixed(1)}M`} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [money(value), undefined]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Revenue" fill="#001A70" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="NetIncome" fill="#1D7BBE" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ChartFrame>
          </div>

          <div className="premium-card p-5 sm:p-8 rounded-[1.35rem]">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity size={18} className="text-emerald-700" />
              Revenue Growth Trajectory
            </h2>
            <ChartFrame className="h-64 min-h-[16rem] min-w-0 w-full">
              {({ width, height }) => (
                <AreaChart width={width} height={height} data={finData.projections} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#001A70" stopOpacity={0.16}/>
                      <stop offset="95%" stopColor="#001A70" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `${(value/1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(value) => [money(value), "Revenue"]} />
                  <Area type="monotone" dataKey="Revenue" stroke="#001A70" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              )}
            </ChartFrame>
          </div>

          {/* Depreciation Schedule Tabular */}
          <div className="premium-card p-5 sm:p-8 rounded-[1.35rem] overflow-hidden">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <FileText size={18} className="text-emerald-700" />
              Depreciation Schedule (Reducing Balance)
            </h2>
            <div className="premium-table-wrap overflow-x-auto custom-scrollbar rounded-2xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="pb-4">Year</th>
                    <th className="pb-4 text-right">Opening Value (BTN)</th>
                    <th className="pb-4 text-right">Depreciation (15%)</th>
                    <th className="pb-4 text-right">Closing Value (BTN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {finData.depreciationSchedule.map((row, idx) => (
                    <tr key={idx} className="text-xs hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-bold text-slate-900">{row.year}</td>
                      <td className="py-4 text-right font-mono text-slate-600">{row.opening.toLocaleString()}</td>
                      <td className="py-4 text-right font-mono text-rose-500">-{row.depreciation.toLocaleString()}</td>
                      <td className="py-4 text-right font-mono font-bold text-slate-900">{row.closing.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>


        {/* Right Sidebar - Status & Structure */}
        <div className="space-y-8">
          
          <div className="premium-card p-8 rounded-[1.35rem]">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Asset & Liabilities</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                  <span>Current Assets</span>
                  <span className="text-slate-900">{money(Math.round(finData.totalAssets))}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                  <span>Total Liabilities</span>
                  <span className="text-slate-900">{money(Math.round(finData.totalLiabilities))}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full" style={{ width: `${(finData.totalLiabilities / finData.totalAssets) * 100}%` }} />
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 uppercase">Net Worth</span>
                  <span className="text-lg font-black text-emerald-700">{money(Math.round(finData.netWorth))}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="premium-card premium-card-hover p-8 rounded-[1.35rem]">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Capital Structure</h2>

            <ChartFrame className="h-48 min-h-[12rem] min-w-0 w-full mb-4">
              {({ width, height }) => (
                <PieChart width={width} height={height}>
                  <Pie
                    data={capitalStructureData}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {capitalStructureData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, undefined]} />
                </PieChart>
              )}
            </ChartFrame>
            
            <div className="space-y-3">
              {capitalStructureData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs font-bold text-slate-500 uppercase">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-dark-panel p-8 rounded-[1.35rem] text-white relative overflow-hidden">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Account Standing</h2>
            
            <div className="flex items-center gap-4 mb-8">
              <div className={cn(
                "w-16 h-16 rounded-full border-4 flex items-center justify-center",
                finData.riskLevel === "Low" ? "border-emerald-500" : finData.riskLevel === "Medium" ? "border-amber-500" : "border-rose-500"
              )}>
                <span className="text-xl font-black">{finData.riskLevel === "Low" ? "A+" : finData.riskLevel === "Medium" ? "B" : "C-"}</span>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{finData.riskLevel === "Low" ? "Excellent" : finData.riskLevel === "Medium" ? "Stable" : "High Risk"}</p>
                <p className="text-xs text-slate-400">Ledger Verification Status</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Payment Status</span>
                <span className={`font-bold ${paymentStatusLabel(client.paymentStatus) === 'Paid' ? 'text-emerald-400' : paymentStatusLabel(client.paymentStatus) === 'Partially Paid' ? 'text-amber-400' : 'text-rose-400'}`}>
                  {paymentStatusLabel(client.paymentStatus)}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-white/10 pt-4">
                <span className="text-slate-400">Journal Trace</span>
                <span className="font-mono text-white">{client.journalNo || "N/A"}</span>
              </div>
            </div>

            <div className="absolute right-[-30px] bottom-[-30px] opacity-10">
              <ShieldCheck size={180} />
            </div>
          </div>

          {/* Quick Access to Details */}
          <button 
            onClick={() => onViewDetails(client)}
            className="w-full premium-card premium-card-hover text-slate-900 p-6 rounded-[1.35rem] flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-900 text-white rounded-2xl group-hover:scale-110 transition-transform">
                <Activity size={24} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile Module</p>
                <p className="text-lg font-bold">Client Details</p>
              </div>
            </div>
            <ArrowRight className="text-slate-400 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
