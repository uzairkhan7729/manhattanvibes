export function fmtSAR(halalas: number | undefined): string {
  if (halalas == null) return '—';
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 }).format(halalas / 100);
}
