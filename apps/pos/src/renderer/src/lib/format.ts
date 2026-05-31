export function fmtSAR(halalas: number | undefined): string {
  if (halalas == null) return '—';
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 }).format(halalas / 100);
}

export function newClientOpId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
