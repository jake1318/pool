/**
 * Format large numbers with K, M, B, T suffixes
 */
export function formatLargeNumber(num: number): string {
  if (num === 0) return "0";

  if (num < 1000) {
    return num.toLocaleString();
  }

  const units = ["", "K", "M", "B", "T"];
  const unitIndex = Math.floor(Math.log10(num) / 3);
  const unitValue = num / Math.pow(10, 3 * unitIndex);

  return unitValue.toFixed(2) + units[unitIndex];
}
