import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Factory,
  Info,
  Landmark,
  LineChart,
  PieChart as PieChartIcon,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "../lib/utils";
import { ChartFrame } from "./ChartFrame";

const COLORS = ["#001A70", "#1D7BBE", "#4964A6", "#7B8DBE", "#A9B4D3"];

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const currency = (value, code = "BTN") => {
  const label = code === "BTN" ? "BTN" : code;
  return `${label} ${Math.round(value || 0).toLocaleString()}`;
};

const percent = (value) => `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

const normalize = (value = "") => String(value || "").trim().toLowerCase();

const TooltipTerm = ({ label, title }) => (
  <span className="inline-flex items-center gap-1" title={title}>
    {label}
    <Info size={12} className="text-slate-400" />
  </span>
);

const SummaryCard = ({ title, value, detail, icon: Icon, tone = "blue", indicator }) => {
  const tones = {
    blue: "bg-emerald-50 text-emerald-700 border-emerald-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
  };
  return (
    <div className="ct-analysis-card premium-card premium-card-hover p-5">
      <div className="flex items-start justify-between gap-4">
        <div className={cn("summary-card-icon rounded-2xl border p-2.5 shadow-inner", tones[tone])}>
          <Icon size={18} />
        </div>
        {indicator && (
          <span className="rounded-full border border-slate-100 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {indicator}
          </span>
        )}
      </div>
      <p className="mt-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-medium leading-5 text-slate-500">{detail}</p>
    </div>
  );
};

const buildCompanyGroups = (clients = []) => {
  const groups = new Map();
  clients.forEach((client) => {
    const name = client.organizationName || client.clientName || client.name || "Unassigned Company";
    const key = normalize(name);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name,
        records: [],
        logo: client.companyLogo || "",
        logoName: client.companyLogoName || "",
      });
    }
    const group = groups.get(key);
    group.records.push(client);
    if (!group.logo && client.companyLogo) {
      group.logo = client.companyLogo;
      group.logoName = client.companyLogoName || "";
    }
  });
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const analyzeRecord = (record) => {
  const amount = Math.max(1, toNumber(record.invoiceAmount, toNumber(record.amount, 1)));
  const data = record.financialData || {};
  const capitalCost = Math.max(0, toNumber(data.capitalCost, amount));
  const workingCapital = Math.max(0, toNumber(data.workingCapital, amount * 0.12));
  const revenue = Math.max(0, toNumber(data.pnlRevenue, amount * 0.65));
  const cogs = Math.max(0, toNumber(data.pnlCogs, revenue * 0.36));
  const opex = Math.max(0, toNumber(data.pnlOpex, revenue * 0.18));
  const cfOpening = Math.max(0, toNumber(data.cfOpening, amount * 0.05));
  const cfInflow = Math.max(0, toNumber(data.cfInflow, revenue));
  const cfOutflow = Math.max(0, toNumber(data.cfOutflow, cogs + opex));
  const debtPercent = Math.min(95, Math.max(0, toNumber(data.debtPercent, 45)));
  const equityPercent = Math.min(100, Math.max(5, toNumber(data.equityPercent, 100 - debtPercent)));
  const totalDebt = amount * (debtPercent / 100);
  const securedDebt = totalDebt * 0.82;
  const unsecuredDebt = totalDebt - securedDebt;
  const currentLiabilities = workingCapital * 0.35 + unsecuredDebt * 0.45 + totalDebt * 0.12;
  const totalAssets = capitalCost + workingCapital + cfOpening + Math.max(0, cfInflow - cfOutflow);
  const totalLiabilities = totalDebt + currentLiabilities;
  const equity = Math.max(0, totalAssets - totalLiabilities);
  const investmentBase = Math.max(1, capitalCost + workingCapital);
  const netIncome = revenue - cogs - opex - totalDebt * (toNumber(data.financingCost, 6) / 100);
  const roi = (netIncome / investmentBase) * 100;
  const depreciation = [
    { type: "Plant & Equipment", amount: capitalCost * 0.08 },
    { type: "Office Assets", amount: capitalCost * 0.035 },
    { type: "Technology", amount: workingCapital * 0.06 },
    { type: "Leasehold", amount: amount * 0.018 },
  ];

  return {
    amount,
    capitalCost,
    workingCapital,
    revenue,
    cogs,
    opex,
    currentLiabilities,
    totalAssets,
    totalLiabilities,
    equity,
    totalDebt,
    securedDebt,
    unsecuredDebt,
    netIncome,
    roi,
    depreciation,
    debtPercent,
    equityPercent,
    currencyCode: record.currency || "BTN",
  };
};

const analyzeCompany = (company) => {
  const rows = company.records.map(analyzeRecord);
  const totals = rows.reduce(
    (acc, row) => {
      Object.keys(acc).forEach((key) => {
        if (typeof acc[key] === "number") acc[key] += row[key] || 0;
      });
      row.depreciation.forEach((item) => {
        acc.depreciation[item.type] = (acc.depreciation[item.type] || 0) + item.amount;
      });
      return acc;
    },
    {
      amount: 0,
      capitalCost: 0,
      workingCapital: 0,
      revenue: 0,
      cogs: 0,
      opex: 0,
      currentLiabilities: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      equity: 0,
      totalDebt: 0,
      securedDebt: 0,
      unsecuredDebt: 0,
      netIncome: 0,
      depreciation: {},
    },
  );
  const investmentBase = Math.max(1, totals.capitalCost + totals.workingCapital);
  const roi = (totals.netIncome / investmentBase) * 100;
  const first = company.records[0] || {};
  const currencyCode = first.currency || "BTN";
  const depreciationRows = Object.entries(totals.depreciation).map(([type, amount]) => ({ type, amount: Math.round(amount) }));
  const totalDepreciation = depreciationRows.reduce((sum, item) => sum + item.amount, 0);
  const currentLiabilityBreakdown = [
    { name: "Working Capital Payables", value: Math.round(totals.workingCapital * 0.35) },
    { name: "Current Debt Portion", value: Math.round(totals.totalDebt * 0.12) },
    { name: "Unsecured Short-Term", value: Math.round(totals.unsecuredDebt * 0.45) },
  ];
  const balanceSheet = [
    { name: "Assets", value: Math.round(totals.totalAssets) },
    { name: "Liabilities", value: Math.round(totals.totalLiabilities) },
    { name: "Equity", value: Math.round(totals.equity) },
  ];
  const debtSplit = [
    { name: "Secured Debt", value: Math.round(totals.securedDebt) },
    { name: "Unsecured Debt", value: Math.round(totals.unsecuredDebt) },
  ];
  const margin = totals.revenue > 0 ? (totals.netIncome / totals.revenue) * 100 : 0;
  const leverage = totals.totalAssets > 0 ? (totals.totalLiabilities / totals.totalAssets) * 100 : 0;

  return {
    ...totals,
    roi,
    margin,
    leverage,
    currencyCode,
    depreciationRows,
    totalDepreciation,
    currentLiabilityBreakdown,
    balanceSheet,
    debtSplit,
    profile: {
      companyName: company.name,
      logo: company.logo,
      logoName: company.logoName,
      registration: first.cid || first.passport || first.journalNo || "Not recorded",
      businessType: first.type || first.clientType || "Corporate",
      citizenship: first.category || first.citizenship || "Not recorded",
      country: first.country || first.location || "Not recorded",
      records: company.records.length,
    },
  };
};

export function FinancialDataAnalysis({ clients = [], onViewDetails }) {
  const companies = useMemo(() => buildCompanyGroups(clients), [clients]);
  const [selectedKey, setSelectedKey] = useState("");
  const selectedCompany = companies.find((company) => company.key === (selectedKey || companies[0]?.key)) || companies[0];
  const analysis = selectedCompany ? analyzeCompany(selectedCompany) : null;

  if (!analysis) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 motion-page">
        <div className="premium-card mx-auto max-w-xl rounded-[1.6rem] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
            <BarChart3 size={22} />
          </div>
          <h1 className="mt-4 text-xl font-black text-slate-950">Financial Data Analysis</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">No company records are available for analysis yet.</p>
        </div>
      </div>
    );
  }

  const riskTone = analysis.leverage > 70 ? "rose" : analysis.leverage > 50 ? "amber" : "green";

  return (
    <div className="ct-page p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8 motion-page pb-20">
      <div className="ct-analysis-hero flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="ct-eyebrow">
            Financial Intelligence
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Financial Data Analysis</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/64">
            Company-level balance sheet, liability, ROI, debt, and depreciation overview from the existing invoice records.
          </p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/48">Company</span>
          <select
            value={selectedCompany.key}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="premium-input ui-select min-w-[16rem] px-4 py-3 text-sm font-black text-slate-900 outline-none"
          >
            {companies.map((company) => (
              <option key={company.key} value={company.key}>{company.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="premium-card p-6 xl:col-span-4 2xl:col-span-3">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {analysis.profile.logo ? (
                <img src={analysis.profile.logo} alt={`${analysis.profile.companyName} logo`} className="h-full w-full object-contain p-2" />
              ) : (
                <Building2 size={28} className="text-slate-300" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company Profile</p>
              <h2 className="mt-1 text-xl font-black leading-tight text-slate-950 sm:text-2xl">{analysis.profile.companyName}</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">{analysis.profile.businessType} / {analysis.profile.citizenship}</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
            {[
              ["Registration", analysis.profile.registration],
              ["Country", analysis.profile.country],
              ["Records", analysis.profile.records],
              ["Logo", analysis.profile.logo ? analysis.profile.logoName || "Available" : "Not provided"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[var(--ct-line)] bg-white/70 p-4">
                <p className="font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-2 font-black text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          {selectedCompany.records[0] && (
            <button
              type="button"
              onClick={() => onViewDetails?.(selectedCompany.records[0])}
              className="ui-btn ui-btn-md ui-btn-secondary mt-5 w-full"
            >
              Open Company Record
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-8 xl:grid-cols-2 2xl:col-span-9 2xl:grid-cols-4">
          <SummaryCard
            title={<TooltipTerm label="ROI" title="Return on Investment compares net income with invested capital." />}
            value={percent(analysis.roi)}
            detail={`${currency(analysis.netIncome, analysis.currencyCode)} net income on ${currency(analysis.capitalCost + analysis.workingCapital, analysis.currencyCode)} invested.`}
            icon={TrendingUp}
            tone="green"
            indicator="Return"
          />
          <SummaryCard
            title={<TooltipTerm label="Current Liabilities" title="Short-term obligations estimated from working capital payables, current debt portion, and unsecured short-term exposure." />}
            value={currency(analysis.currentLiabilities, analysis.currencyCode)}
            detail="Short-term obligations requiring near-term monitoring."
            icon={WalletCards}
            tone={riskTone}
            indicator={`${percent(analysis.leverage)} leverage`}
          />
          <SummaryCard
            title={<TooltipTerm label="Secured Debt" title="Debt backed by collateral or pledged assets." />}
            value={currency(analysis.securedDebt, analysis.currencyCode)}
            detail="Collateral-backed debt exposure separated from unsecured borrowings."
            icon={ShieldCheck}
            tone="blue"
            indicator="Collateral"
          />
          <SummaryCard
            title={<TooltipTerm label="Depreciation" title="Estimated reduction in asset value by asset category." />}
            value={currency(analysis.totalDepreciation, analysis.currencyCode)}
            detail="Total estimated annual depreciation across asset categories."
            icon={Factory}
            tone="violet"
            indicator="Annual"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="premium-card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Total Balance Sheet</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">Assets, liabilities, and equity from existing company records.</p>
            </div>
            <Landmark className="text-emerald-700" size={20} />
          </div>
          <ChartFrame className="h-72 min-h-[18rem] min-w-0">
            {({ width, height }) => (
              <BarChart width={width} height={height} data={analysis.balanceSheet} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(value) => currency(value, analysis.currencyCode)} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {analysis.balanceSheet.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ChartFrame>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {analysis.balanceSheet.map((item, index) => (
              <div key={item.name} className="rounded-lg border border-[var(--ct-line)] bg-white/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.name}</p>
                <p className="mt-2 text-lg font-black text-slate-950">{currency(item.value, analysis.currencyCode)}</p>
                <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (item.value / Math.max(1, analysis.totalAssets)) * 100)}%`,
                      backgroundColor: COLORS[index],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="premium-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Debt Split</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">Secured vs unsecured obligations.</p>
            </div>
            <PieChartIcon className="text-emerald-700" size={20} />
          </div>
          <ChartFrame className="h-56 min-h-[14rem] min-w-0">
            {({ width, height }) => (
              <PieChart width={width} height={height}>
                <Pie data={analysis.debtSplit} innerRadius={54} outerRadius={82} paddingAngle={4} dataKey="value">
                  {analysis.debtSplit.map((entry, index) => (
                    <Cell key={entry.name} fill={index === 0 ? "#001A70" : "#1D7BBE"} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => currency(value, analysis.currencyCode)} />
              </PieChart>
            )}
          </ChartFrame>
          <div className="space-y-3">
            {analysis.debtSplit.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ct-line)] bg-white/70 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: index === 0 ? "#001A70" : "#1D7BBE" }} />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">{item.name}</span>
                </div>
                <span className="text-sm font-black text-slate-950">{currency(item.value, analysis.currencyCode)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="premium-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Current Liabilities Breakdown</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">Near-term obligation components.</p>
            </div>
            <AlertTriangle className="text-amber-600" size={20} />
          </div>
          <div className="space-y-4">
            {analysis.currentLiabilityBreakdown.map((item, index) => (
              <div key={item.name}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">{item.name}</p>
                  <p className="text-sm font-black text-slate-950">{currency(item.value, analysis.currencyCode)}</p>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (item.value / Math.max(1, analysis.currentLiabilities)) * 100)}%`,
                      backgroundColor: COLORS[index + 2],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="premium-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Depreciation By Asset Type</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">Estimated annual asset value reduction.</p>
            </div>
            <LineChart className="text-violet-700" size={20} />
          </div>
          <div className="premium-table-wrap overflow-x-auto rounded-2xl custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-3">Asset / Type</th>
                  <th className="px-4 py-3 text-right">Depreciation</th>
                  <th className="px-4 py-3 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {analysis.depreciationRows.map((item) => (
                  <tr key={item.type} className="text-xs">
                    <td className="px-4 py-3 font-black text-slate-900">{item.type}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">-{currency(item.amount, analysis.currencyCode)}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-600">
                      {percent((item.amount / Math.max(1, analysis.totalDepreciation)) * 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
