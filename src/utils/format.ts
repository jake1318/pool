// format.ts
// ● formatUSD: $1,234,567.89
// ● formatPercent: 12.34%
export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * value is a decimal ratio, e.g. 0.1234 → "12.34%"
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
