// Historically named fmtSAR; now formats Pakistani Rupees.
export function fmtSAR(paisa: number | undefined): string {
  if (paisa == null) return '—';
  const rupees = Math.round(paisa / 100);
  return `Rs ${rupees.toLocaleString('en-PK')}`;
}

export function newClientOpId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
