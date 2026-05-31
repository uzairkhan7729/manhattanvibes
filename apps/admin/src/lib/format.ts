/** Halalas (integer) → SAR string. */
export function fmtSAR(halalas: number | undefined, locale: 'en' | 'ar' = 'en'): string {
  if (halalas == null) return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
    style: 'currency', currency: 'SAR', minimumFractionDigits: 2,
  }).format(halalas / 100);
}

export function fmtDate(iso: string | Date | undefined, withTime = true): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-SA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: 'short', day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function fmtNumber(n: number | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-SA').format(n);
}
