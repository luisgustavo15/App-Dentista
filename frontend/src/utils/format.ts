/** Brazilian currency without relying on Intl (Hermes has partial support). */
export function formatBRL(value: number) {
  const [int, dec] = Math.abs(value).toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${value < 0 ? "-" : ""}R$ ${grouped},${dec}`;
}

/** Parses "1.234,56", "1234.56" or "180" into a number; NaN when invalid. */
export function parseBRL(text: string) {
  const clean = text.replace(/[^\d,.]/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  return normalized ? Number(normalized) : NaN;
}
