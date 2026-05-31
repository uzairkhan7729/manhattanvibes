export function fmtSAR(halalas: number | undefined): string {
  if (halalas == null) return '—';
  return `${(halalas / 100).toFixed(2)} SAR`;
}
