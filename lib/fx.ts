export function fxEstimate(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): number | null {
  if (fromCurrency === toCurrency) return amount;
  if (fromCurrency === "USD" && toCurrency === "ARS") return amount * rate;
  if (fromCurrency === "ARS" && toCurrency === "USD") return amount / rate;
  return null;
}
