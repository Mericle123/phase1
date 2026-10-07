import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Factory,
  Info,
  Landmark,
  LineChart,
  PieChart as PieChartIcon,
  ReceiptText,
  Search,
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

const DISTRIBUTION_BANDS = [
  { label: "Below −3σ", low: -Infinity, high: -3, reference: "0.13%", fill: "#dbe1ed" },
  { label: "−3σ to −2σ", low: -3, high: -2, reference: "2.14%", fill: "#bac4da" },
  { label: "−2σ to −1σ", low: -2, high: -1, reference: "13.59%", fill: "#8292b7" },
  { label: "−1σ to mean", low: -1, high: 0, reference: "34.13%", fill: "#52638f" },
  { label: "Mean to +1σ", low: 0, high: 1, reference: "34.13%", fill: "#52638f" },
  { label: "+1σ to +2σ", low: 1, high: 2, reference: "13.59%", fill: "#8292b7" },
  { label: "+2σ to +3σ", low: 2, high: 3, reference: "2.14%", fill: "#bac4da" },
  { label: "Above +3σ", low: 3, high: Infinity, reference: "0.13%", fill: "#dbe1ed" },
];

const STATEMENT_METRICS = {
  income: [
    ["revenue", "Revenue"], ["cogs", "Cost of sales"], ["grossProfit", "Gross profit"],
    ["opex", "Operating expenses"], ["operatingIncome", "Operating income"],
    ["financingCosts", "Finance costs"], ["netIncome", "Net income"],
  ],
  balance: [
    ["capitalCost", "Capital assets"], ["workingCapital", "Working capital"],
    ["cashPosition", "Cash and operating position"], ["totalAssets", "Total assets"],
    ["securedDebt", "Secured debt"], ["unsecuredDebt", "Unsecured debt"],
    ["currentLiabilities", "Current liabilities"], ["totalLiabilities", "Total liabilities"],
    ["equity", "Equity"], ["liabilitiesAndEquity", "Total liabilities and equity"],
  ],
};

const SUPPORTED_STATEMENT_CURRENCIES = ["BTN", "USD", "NZD", "INR", "AUD", "EUR"];
const STATEMENT_CURRENCY_NAMES = {
  BTN: "BTN · Bhutanese Ngultrum",
  USD: "USD · US Dollar",
  NZD: "NZD · New Zealand Dollar",
  INR: "INR · Indian Rupee",
  AUD: "AUD · Australian Dollar",
  EUR: "EUR · Euro",
};

const statementMetricValue = (record, statement, metric) => {
  const values = analyzeRecord(record);
  const metricValues = {
    income: values,
    balance: {
      ...values,
      cashPosition: values.cfOpening + Math.max(0, values.cfInflow - values.cfOutflow),
      liabilitiesAndEquity: values.totalLiabilities + values.equity,
    },
  };
  return metricValues[statement]?.[metric];
};

const FinancialStatementBellCurve = ({ records, companyName, statementView, currencyCode }) => {
  const metrics = STATEMENT_METRICS[statementView] || STATEMENT_METRICS.income;
  const [selectedMetric, setSelectedMetric] = useState(metrics[0][0]);
  const [selectedCurrency, setSelectedCurrency] = useState(currencyCode || "BTN");
  const [activeBand, setActiveBand] = useState(4);
  const observedCurrencyCounts = useMemo(() => records.reduce((counts, record) => {
    const code = record.currency || "BTN";
    counts[code] = (counts[code] || 0) + 1;
    return counts;
  }, {}), [records]);
  const currencies = useMemo(
    () => [...new Set([...SUPPORTED_STATEMENT_CURRENCIES, ...Object.keys(observedCurrencyCounts)])].sort(),
    [observedCurrencyCounts],
  );
  const metricKey = metrics.some(([key]) => key === selectedMetric) ? selectedMetric : metrics[0][0];
  const activeCurrency = currencies.includes(selectedCurrency) ? selectedCurrency : currencyCode || currencies[0] || "BTN";
  const metricLabel = metrics.find(([key]) => key === metricKey)?.[1] || metrics[0][1];
  const values = useMemo(() => records
    .filter((record) => (record.currency || "BTN") === activeCurrency)
    .map((record) => statementMetricValue(record, statementView, metricKey))
    .filter(Number.isFinite), [records, activeCurrency, statementView, metricKey]);
  const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const deviation = values.length
    ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
    : 0;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[Math.floor(sorted.length / 2)]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : 0;
  const counts = DISTRIBUTION_BANDS.map((band) => ({ ...band, count: 0 }));
  values.forEach((value) => {
    const z = deviation ? (value - mean) / deviation : 0;
    const index = counts.findIndex((band, bandIndex) => (
      z >= band.low && (z < band.high || (bandIndex === counts.length - 1 && z <= band.high))
    ));
    counts[Math.max(0, index)].count += 1;
  });

  const plotX = (z) => 84 + ((z + 4) / 8) * 672;
  const plotY = (z) => 274 - ((Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) / 0.4) * 190;
  const curvePoints = Array.from({ length: 161 }, (_, index) => -4 + (index / 160) * 8);
  const curvePath = curvePoints.map((z, index) => `${index ? "L" : "M"}${plotX(z).toFixed(1)},${plotY(z).toFixed(1)}`).join(" ");
  const bandPath = (low, high) => {
    const start = Math.max(-4, low);
    const end = Math.min(4, high);
    const points = Array.from({ length: 25 }, (_, index) => start + (index / 24) * (end - start));
    return `M${plotX(start)},274 ${points.map((z) => `L${plotX(z).toFixed(1)},${plotY(z).toFixed(1)}`).join(" ")} L${plotX(end)},274 Z`;
  };
  const updateBandFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const viewX = ((event.clientX - bounds.left) / bounds.width) * 840;
    if (viewX < 84 || viewX > 756) {
      setActiveBand(null);
      return;
    }
    const z = -4 + ((viewX - 84) / 672) * 8;
    const index = counts.findIndex((band, bandIndex) => (
      z >= band.low && (z < band.high || (bandIndex === counts.length - 1 && z <= band.high))
    ));
    setActiveBand(index < 0 ? null : index);
  };
  const bandAmount = (band) => {
    if (!deviation) return band.count ? `${currency(mean, activeCurrency)} · observed value` : "Not estimable yet";
    const lower = Number.isFinite(band.low) ? mean + band.low * deviation : null;
    const upper = Number.isFinite(band.high) ? mean + band.high * deviation : null;
    if (lower === null) return `Below ${currency(upper, activeCurrency)}`;
    if (upper === null) return `Above ${currency(lower, activeCurrency)}`;
    return `${currency(lower, activeCurrency)} – ${currency(upper, activeCurrency)}`;
  };
  const singleRecord = values.length === 1;
  const noVariation = values.length > 1 && deviation === 0;
  const detailBand = counts[activeBand ?? 4];

  return (
    <section className="premium-card financial-bell-curve" aria-labelledby="financial-bell-curve-title">
      <header className="financial-bell-curve-header">
        <div>
          <div className="ct-eyebrow">Financial statement analysis</div>
          <h2 id="financial-bell-curve-title">{companyName} · {metricLabel} Bell Curve</h2>
          <p>View this statement amount against a normal-distribution reference and inspect the observed records.</p>
        </div>
        <div className="financial-bell-curve-controls">
          <label>
            <span>Statement line</span>
            <select value={metricKey} onChange={(event) => { setSelectedMetric(event.target.value); setActiveBand(4); }}>
              {metrics.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Currency</span>
            <select value={activeCurrency} onChange={(event) => { setSelectedCurrency(event.target.value); setActiveBand(4); }}>
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {STATEMENT_CURRENCY_NAMES[code] || code}{observedCurrencyCounts[code] ? "" : " · no records"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {values.length ? (
        <>
          <div className="financial-bell-curve-stats">
            {[
              ["Records", values.length],
              ["Mean", currency(mean, activeCurrency)],
              ["Median", currency(median, activeCurrency)],
              ["Std. deviation", currency(deviation, activeCurrency)],
            ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>

          {(singleRecord || noVariation) && (
            <div className="financial-bell-curve-notice" role="note">
              <Info size={17} />
              <span>{singleRecord
                ? "One saved record: the bell curve is shown as a normal-reference illustration centered on its actual amount. One record cannot establish a real distribution or standard deviation."
                : "All saved values are identical, so there is no observed spread. The bell curve is a normal-reference illustration, not a fitted distribution."}</span>
            </div>
          )}

          <div className="financial-bell-curve-legend" aria-hidden="true">
            <span><i className="financial-bell-curve-legend-line" /> Normal reference</span>
            <span><i className="financial-bell-curve-legend-point" /> Observed record values</span>
          </div>
          <div className="financial-bell-curve-chart-wrap">
            <div className="financial-bell-curve-hover-tooltip" role="status" aria-live="polite">
              <strong>{detailBand.label}</strong>
              <span>{bandAmount(detailBand)}</span>
              <span>Normal reference: {detailBand.reference}</span>
              <span>Observed: {detailBand.count} record{detailBand.count === 1 ? "" : "s"} ({percent((detailBand.count / values.length) * 100)})</span>
            </div>
            <svg
              viewBox="0 0 840 398"
              role="img"
              aria-labelledby="financial-bell-curve-svg-title financial-bell-curve-svg-desc"
              onPointerMove={updateBandFromPointer}
              onPointerLeave={() => setActiveBand(null)}
            >
              <title id="financial-bell-curve-svg-title">Normal distribution reference for {metricLabel}</title>
              <desc id="financial-bell-curve-svg-desc">A bell-shaped normal reference centered on the selected statement mean of {currency(mean, activeCurrency)}. Shaded regions are interactive; actual record counts appear below. {singleRecord ? "With one record, no actual standard deviation can be estimated." : ""}</desc>
              {[0.1, 0.2, 0.3, 0.4].map((density) => {
                const y = 274 - (density / 0.4) * 190;
                return <g key={density}><line x1="84" x2="756" y1={y} y2={y} className="financial-bell-curve-grid" /><text x="72" y={y + 4} textAnchor="end" className="financial-bell-curve-density-label">{density.toFixed(1)}</text></g>;
              })}
              <text x="20" y="170" textAnchor="middle" transform="rotate(-90 20 170)" className="financial-bell-curve-axis-label">Probability density</text>
              {[-3, -2, -1, 0, 1, 2, 3].map((z) => (
                <line key={z} x1={plotX(z)} x2={plotX(z)} y1={z === 0 ? 50 : 90} y2="274" className={z === 0 ? "financial-bell-curve-mean-line" : "financial-bell-curve-tick-line"} />
              ))}
              {counts.map((band, index) => {
                const middle = index === 0 ? -3.55 : index === 7 ? 3.55 : (band.low + band.high) / 2;
                return (
                  <g key={band.label}>
                    <path
                      d={bandPath(band.low, band.high)}
                      fill={band.fill}
                      fillOpacity={activeBand === index ? "0.96" : "0.78"}
                      className={cn("financial-bell-curve-band", activeBand === index && "is-active")}
                      role="button"
                      tabIndex="0"
                      aria-pressed={activeBand === index}
                      aria-label={`${band.label}; normal reference ${band.reference}; ${band.count} observed record${band.count === 1 ? "" : "s"}`}
                      onMouseEnter={() => setActiveBand(index)}
                      onFocus={() => setActiveBand(index)}
                      onClick={() => setActiveBand(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActiveBand(index);
                        }
                      }}
                    />
                    <text x={plotX(middle)} y={Math.max(68, plotY(middle) - 13)} textAnchor="middle" className="financial-bell-curve-percent">{band.reference}</text>
                  </g>
                );
              })}
              <path d={curvePath} fill="none" className="financial-bell-curve-line" />
              <line x1="84" x2="756" y1="274" y2="274" className="financial-bell-curve-axis" />
              {values.map((value, index) => {
                const z = deviation ? (value - mean) / deviation : 0;
                return <circle key={`${index}-${value}`} cx={plotX(z)} cy={274 - (index % 3) * 5} r="4" className="financial-bell-curve-observation" aria-label={`Observed record amount ${currency(value, activeCurrency)}`} />;
              })}
              <text x={plotX(0)} y="28" textAnchor="middle" className="financial-bell-curve-mean-label">Mean · {currency(mean, activeCurrency)}</text>
              {[-3, -2, -1, 0, 1, 2, 3].map((z) => (
                <g key={z}>
                  <line x1={plotX(z)} x2={plotX(z)} y1="274" y2="281" className="financial-bell-curve-axis" />
                  <text x={plotX(z)} y="299" textAnchor="middle" className="financial-bell-curve-tick-label">{z > 0 ? `+${z}σ` : z < 0 ? `−${Math.abs(z)}σ` : "0"}</text>
                </g>
              ))}
              <text x="420" y="325" textAnchor="middle" className="financial-bell-curve-axis-label">Standard deviations from the mean (z-score)</text>
              <line x1="84" x2="756" y1="344" y2="344" className="financial-bell-curve-secondary-axis" />
              {[[-3, "0.1%"], [-2, "2.3%"], [-1, "15.9%"], [0, "50%"], [1, "84.1%"], [2, "97.7%"], [3, "99.9%"]].map(([z, label]) => (
                <g key={z}><line x1={plotX(z)} x2={plotX(z)} y1="340" y2="349" className="financial-bell-curve-secondary-axis" /><text x={plotX(z)} y="365" textAnchor="middle" className="financial-bell-curve-tick-label">{label}</text></g>
              ))}
              <text x="420" y="379" textAnchor="middle" className="financial-bell-curve-axis-label">Cumulative reference</text>
            </svg>
          </div>

          <div className="financial-bell-curve-coverage" aria-label="Normal distribution reference coverage">
            <span><strong>68.27%</strong> within ±1σ</span>
            <span><strong>95%</strong> within ±1.96σ</span>
            <span><strong>99%</strong> within ±2.58σ</span>
          </div>
          <div className="financial-bell-curve-table-wrap">
            <table className="financial-bell-curve-table">
              <thead><tr><th>Standard deviation band</th><th>Statement amount range</th><th>Normal reference</th><th>Records</th><th>Observed</th></tr></thead>
              <tbody>{counts.map((band, index) => (
                <tr
                  key={band.label}
                  tabIndex="0"
                  className={cn(activeBand === index && "is-active")}
                  onMouseEnter={() => setActiveBand(index)}
                  onFocus={() => setActiveBand(index)}
                >
                  <th scope="row"><span className="financial-bell-curve-swatch" style={{ backgroundColor: band.fill }} />{band.label}</th>
                  <td>{bandAmount(band)}</td><td>{band.reference}</td><td>{band.count}</td><td>{percent((band.count / values.length) * 100)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="financial-bell-curve-note">The bell shape and percentages are a normal-distribution reference, not a prediction. The observed counts come only from this company’s saved records. A real spread is calculated only when the records contain variation.</p>
        </>
      ) : (
        <div className="analysis-directory-empty">
          <BarChart3 size={22} />
          <h3>No {metricLabel.toLowerCase()} values in {activeCurrency}</h3>
          <p>Choose another statement line or currency, or add the missing financial statement data.</p>
        </div>
      )}
    </section>
  );
};

const FinancialStatementBarChart = ({ rows, currencyCode, statementTitle }) => {
  const chartData = rows.map((row) => ({
    name: row.label,
    value: row.type === "deduction" ? -Math.abs(row.value) : row.value,
  }));
  const compactAmount = (value) => new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

  return (
    <div className="financial-statement-bar-column">
      <div className="financial-statement-bar-heading">
        <h4>{statementTitle} figures</h4>
        <p>Hover or focus a bar to inspect its amount.</p>
      </div>
      <ChartFrame className="financial-statement-bar-frame">
        {({ width, height }) => (
          <BarChart
            width={width}
            height={height}
            data={chartData}
            layout="vertical"
            margin={{ top: 6, right: 16, left: 4, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="#e6eaf1" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickFormatter={compactAmount}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={132}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#475569" }}
            />
            <Tooltip
              cursor={{ fill: "rgba(0, 26, 112, 0.05)" }}
              content={({ active, payload, label }) => active && payload?.length ? (
                <div className="financial-statement-bar-tooltip">
                  <strong>{label}</strong>
                  <span>{currency(payload[0].value, currencyCode)}</span>
                </div>
              ) : null}
            />
            <Bar dataKey="value" name="Amount" maxBarSize={22} radius={[0, 4, 4, 0]}>
              {chartData.map((item) => (
                <Cell key={item.name} fill={item.value < 0 ? "#E1261B" : "#001A70"} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ChartFrame>
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
  const equity = totalAssets - totalLiabilities;
  const investmentBase = Math.max(1, capitalCost + workingCapital);
  const financingCosts = totalDebt * (toNumber(data.financingCost, 6) / 100);
  const grossProfit = revenue - cogs;
  const operatingIncome = grossProfit - opex;
  const netIncome = operatingIncome - financingCosts;
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
    cfOpening,
    cfInflow,
    cfOutflow,
    currentLiabilities,
    totalAssets,
    totalLiabilities,
    equity,
    totalDebt,
    securedDebt,
    unsecuredDebt,
    grossProfit,
    operatingIncome,
    financingCosts,
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
      cfOpening: 0,
      cfInflow: 0,
      cfOutflow: 0,
      currentLiabilities: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      equity: 0,
      totalDebt: 0,
      securedDebt: 0,
      unsecuredDebt: 0,
      grossProfit: 0,
      operatingIncome: 0,
      financingCosts: 0,
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
  const grossMargin = totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : 0;
  const operatingMargin = totals.revenue > 0 ? (totals.operatingIncome / totals.revenue) * 100 : 0;
  const leverage = totals.totalAssets > 0 ? (totals.totalLiabilities / totals.totalAssets) * 100 : 0;
  const incomeStatement = [
    { label: "Revenue", value: totals.revenue, type: "income" },
    { label: "Cost of Sales", value: totals.cogs, type: "deduction" },
    { label: "Gross Profit", value: totals.grossProfit, type: "subtotal" },
    { label: "Operating Expenses", value: totals.opex, type: "deduction" },
    { label: "Operating Income", value: totals.operatingIncome, type: "subtotal" },
    { label: "Finance Costs", value: totals.financingCosts, type: "deduction" },
    { label: "Net Income", value: totals.netIncome, type: "total" },
  ];
  const balanceStatement = [
    { label: "Capital assets", value: totals.capitalCost, type: "detail" },
    { label: "Working capital", value: totals.workingCapital, type: "detail" },
    { label: "Cash and operating position", value: totals.cfOpening + Math.max(0, totals.cfInflow - totals.cfOutflow), type: "detail" },
    { label: "Total Assets", value: totals.totalAssets, type: "total" },
    { label: "Secured debt", value: totals.securedDebt, type: "detail" },
    { label: "Unsecured debt", value: totals.unsecuredDebt, type: "detail" },
    { label: "Current liabilities", value: totals.currentLiabilities, type: "detail" },
    { label: "Total Liabilities", value: totals.totalLiabilities, type: "subtotal" },
    { label: "Equity", value: totals.equity, type: "detail" },
    { label: "Total Liabilities & Equity", value: totals.totalLiabilities + totals.equity, type: "total" },
  ];
  return {
    ...totals,
    roi,
    margin,
    grossMargin,
    operatingMargin,
    leverage,
    incomeStatement,
    balanceStatement,
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

export function FinancialDataAnalysis({ clients = [], onViewDetails, onBack }) {
  const companies = useMemo(() => buildCompanyGroups(clients), [clients]);
  const [selectedKey, setSelectedKey] = useState("");
  const [showDirectory, setShowDirectory] = useState(true);
  const [statementView, setStatementView] = useState("income");
  const [directorySearch, setDirectorySearch] = useState("");
  const selectedCompany = companies.find((company) => company.key === (selectedKey || companies[0]?.key)) || companies[0];
  const analysis = selectedCompany ? analyzeCompany(selectedCompany) : null;

  const directoryCompanies = useMemo(() => {
    const query = normalize(directorySearch);
    if (!query) return companies;
    return companies.filter((company) => {
      const first = company.records[0] || {};
      return [
        company.name,
        first.type,
        first.clientType,
        first.category,
        first.citizenship,
        first.country,
        first.location,
        first.journalNo,
        first.enteredByName,
      ].some((value) => normalize(value).includes(query));
    });
  }, [companies, directorySearch]);

  const openAnalysis = (company) => {
    setSelectedKey(company.key);
    setShowDirectory(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backToDirectory = () => {
    setShowDirectory(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  if (showDirectory) {
    return (
      <div className="ct-page mx-auto max-w-[1600px] space-y-6 p-4 pb-20 sm:p-6 lg:p-8 motion-page">
        <header className="analysis-directory-header">
          <div>
            {onBack && (
              <button type="button" onClick={onBack} className="analysis-directory-back">
                <ArrowLeft size={16} />
                Back to dashboard
              </button>
            )}
            <div className="ct-eyebrow">Financial Intelligence</div>
            <h1>Client Financial Directory</h1>
            <p>Select a client to review its income statement, balance sheet, and financial analysis.</p>
          </div>
          <div className="analysis-directory-count" aria-label={`${companies.length} clients available`}>
            <strong>{companies.length}</strong>
            <span>Clients</span>
          </div>
        </header>

        <section className="premium-card analysis-directory-shell">
          <div className="analysis-directory-toolbar">
            <div>
              <h2>Client Directory</h2>
              <p>Company records available for financial analysis</p>
            </div>
            <label className="analysis-directory-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search clients</span>
              <input
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
                placeholder="Search client, location, journal or employee"
              />
            </label>
          </div>

          <div className="analysis-directory-table-wrap">
            <table className="analysis-directory-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Business Profile</th>
                  <th>Records</th>
                  <th>Total Invoice Value</th>
                  <th>Entered By</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {directoryCompanies.map((company) => {
                  const first = company.records[0] || {};
                  const invoiceTotal = company.records.reduce(
                    (sum, record) => sum + Math.max(0, toNumber(record.invoiceAmount, record.amount)),
                    0,
                  );
                  return (
                    <tr key={company.key}>
                      <td>
                        <div className="analysis-client-identity">
                          <span className="analysis-client-logo">
                            {company.logo ? (
                              <img src={company.logo} alt="" />
                            ) : (
                              <Building2 size={18} />
                            )}
                          </span>
                          <span>
                            <strong>{company.name}</strong>
                            <small>{first.journalNo || "No journal number"}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong className="analysis-table-primary">{first.type || first.clientType || "Corporate"}</strong>
                        <small className="analysis-table-secondary">{first.country || first.location || first.category || "Location not recorded"}</small>
                      </td>
                      <td><span className="analysis-record-count">{company.records.length}</span></td>
                      <td><strong className="analysis-table-amount">{currency(invoiceTotal, first.currency || "BTN")}</strong></td>
                      <td>
                        <strong className="analysis-table-primary">{first.enteredByName || "System"}</strong>
                        <small className="analysis-table-secondary">{first.department || "Data Entry"}</small>
                      </td>
                      <td>
                        <button type="button" onClick={() => openAnalysis(company)} className="ui-btn ui-btn-sm ui-btn-primary analysis-open-button">
                          View Financial Analysis
                          <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="analysis-directory-cards">
            {directoryCompanies.map((company) => {
              const first = company.records[0] || {};
              const invoiceTotal = company.records.reduce(
                (sum, record) => sum + Math.max(0, toNumber(record.invoiceAmount, record.amount)),
                0,
              );
              return (
                <article key={company.key} className="analysis-directory-card">
                  <div className="analysis-client-identity">
                    <span className="analysis-client-logo">
                      {company.logo ? <img src={company.logo} alt="" /> : <Building2 size={18} />}
                    </span>
                    <span>
                      <strong>{company.name}</strong>
                      <small>{first.journalNo || "No journal number"}</small>
                    </span>
                  </div>
                  <dl>
                    <div><dt>Profile</dt><dd>{first.type || first.clientType || "Corporate"}</dd></div>
                    <div><dt>Records</dt><dd>{company.records.length}</dd></div>
                    <div><dt>Invoice Value</dt><dd>{currency(invoiceTotal, first.currency || "BTN")}</dd></div>
                    <div><dt>Entered By</dt><dd>{first.enteredByName || "System"}</dd></div>
                  </dl>
                  <button type="button" onClick={() => openAnalysis(company)} className="ui-btn ui-btn-md ui-btn-primary w-full">
                    View Financial Analysis
                    <ArrowRight size={16} />
                  </button>
                </article>
              );
            })}
          </div>

          {!directoryCompanies.length && (
            <div className="analysis-directory-empty">
              <Search size={22} />
              <h3>No matching clients</h3>
              <p>Try another company, journal, location, or employee name.</p>
            </div>
          )}
        </section>
      </div>
    );
  }

  const riskTone = analysis.leverage > 70 ? "rose" : analysis.leverage > 50 ? "amber" : "green";
  const activeStatementView = statementView === "balance" ? "balance" : "income";
  const statementRows = {
    income: analysis.incomeStatement,
    balance: analysis.balanceStatement,
  }[activeStatementView];
  const statementTitles = {
    income: "Income Statement",
    balance: "Balance Sheet",
  };

  return (
    <div className="ct-page p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8 motion-page pb-20">
      <div className="analysis-detail-toolbar">
        <button type="button" onClick={backToDirectory} className="analysis-return-button">
          <ArrowLeft size={17} />
          <span>Back to client directory</span>
        </button>
        <span className="analysis-detail-context">Financial analysis / {analysis.profile.companyName}</span>
      </div>
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

      <section className="premium-card overflow-hidden" aria-labelledby="financial-statements-heading">
        <div className="financial-statements-header">
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText size={19} className="text-[var(--ds-navy)]" />
              <h2 id="financial-statements-heading">Financial Statements</h2>
            </div>
            <p>Review the company’s income and financial position.</p>
          </div>
          <div className="financial-statement-tabs" role="tablist" aria-label="Financial statement type">
            {[
              ["income", "Income Statement"],
              ["balance", "Balance Sheet"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeStatementView === key}
                aria-controls="financial-statement-panel"
                id={`financial-statement-tab-${key}`}
                onClick={() => setStatementView(key)}
                className="financial-statement-tab"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          id="financial-statement-panel"
          role="tabpanel"
          aria-labelledby={`financial-statement-tab-${activeStatementView}`}
          className="financial-statement-content financial-statement-with-chart"
        >
          <div>
            <div className="financial-statement-title-row">
              <div>
                <h3>{statementTitles[activeStatementView]}</h3>
                <p>{analysis.profile.companyName} · {analysis.profile.records} record{analysis.profile.records === 1 ? "" : "s"}</p>
              </div>
              {activeStatementView === "income" && (
                <span className={cn("ui-status-badge w-fit", analysis.netIncome >= 0 ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700")}>
                  {analysis.netIncome >= 0 ? "Profitable" : "Net Loss"}
                </span>
              )}
            </div>
            <div className="financial-statement-table-wrap">
              <table className="financial-statement-table">
                <thead>
                  <tr><th scope="col">Account</th><th scope="col">Amount ({analysis.currencyCode})</th></tr>
                </thead>
                <tbody>
                  {statementRows.map((row) => (
                    <tr key={row.label} className={cn(row.type === "subtotal" && "financial-statement-subtotal", row.type === "total" && "financial-statement-total")}>
                      <th scope="row">{row.label}</th>
                      <td className={cn(row.value < 0 && "financial-statement-negative")}>
                        {row.type === "deduction" && row.value >= 0 ? "-" : row.value < 0 ? "-" : ""}
                        {currency(Math.abs(row.value), analysis.currencyCode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="financial-statement-note">
              Management view based on saved financial fields. Where a field is blank, estimates are derived from invoice records; this is not an audited statutory statement.
            </p>
          </div>
          <FinancialStatementBarChart
            rows={statementRows}
            currencyCode={analysis.currencyCode}
            statementTitle={statementTitles[activeStatementView]}
          />
        </div>
      </section>

      <FinancialStatementBellCurve
        records={selectedCompany.records}
        companyName={selectedCompany.name}
        statementView={activeStatementView}
        currencyCode={analysis.currencyCode}
      />

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
