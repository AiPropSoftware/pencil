const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const pct2 = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const num0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const fmtMoney = (n: number | null | undefined, cents = false) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return (cents ? usd2 : usd0).format(n);
};

export const fmtPct = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return pct2.format(n);
};

export const fmtNumber = (n: number | null | undefined, decimals = 0) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return (decimals > 0 ? num2 : num0).format(n);
};

export const fmtRatio = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return num2.format(n) + "x";
};

/** Strip non-numeric chars, return raw numeric string (preserves single decimal) */
export const parseNumericInput = (raw: string): string => {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return parts[0] + "." + parts.slice(1).join("");
};

export const displayWithCommas = (raw: string): string => {
  if (raw === "" || raw === "-") return raw;
  const [whole, dec] = raw.split(".");
  const wholeFormatted = num0.format(Number(whole.replace(/-/g, "")) || 0);
  const sign = whole.startsWith("-") ? "-" : "";
  return dec !== undefined ? `${sign}${wholeFormatted}.${dec}` : `${sign}${wholeFormatted}`;
};
