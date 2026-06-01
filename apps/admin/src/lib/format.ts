// Historically named fmtSAR; now formats Pakistani Rupees.
// We store integer paisa (1 PKR = 100 paisa) — same as the old halalas scheme,
// only the symbol changes.
export function fmtSAR(paisa: number | undefined, _locale: 'en' | 'ar' = 'en'): string {
  if (paisa == null) return '—';
  const rupees = Math.round(paisa / 100);
  return `Rs ${rupees.toLocaleString('en-PK')}`;
}

export function fmtDate(iso: string | Date | undefined, withTime = true): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    year: 'numeric', month: 'short', day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function fmtNumber(n: number | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-PK').format(n);
}
