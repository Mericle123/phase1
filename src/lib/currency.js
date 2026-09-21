const currencyLabels = {
  BTN: "Nu.",
  NZD: "NZD",
  INR: "INR",
  EUR: "EUR",
  KWD: "KWD",
  USD: "USD",
};

export const normalizeCurrencyCode = (code = "BTN") => String(code || "BTN").trim().toUpperCase();

export const currencyLabel = (code = "BTN") => {
  const normalized = normalizeCurrencyCode(code);
  return currencyLabels[normalized] || normalized;
};

export const currencyCodeForRecord = (record = {}) => normalizeCurrencyCode(record.currency || "BTN");

export const numericCurrencyAmount = (value) => {
  const parsed = Number.parseFloat(String(value || "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrencyAmount = (value, code = "BTN") =>
  `${currencyLabel(code)} ${numericCurrencyAmount(value).toLocaleString()}`;

export const supportedCurrencyLabels = currencyLabels;
