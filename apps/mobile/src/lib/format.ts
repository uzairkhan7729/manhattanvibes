// Historically named fmtSAR; now formats Pakistani Rupees.
// We store integer paisa (1 PKR = 100 paisa) — same as the old halalas scheme,
// the math is identical, only the symbol changes.
export function fmtSAR(paisa: number | undefined): string {
  if (paisa == null) return '—';
  const rupees = Math.round(paisa / 100);
  return `Rs ${rupees.toLocaleString('en-PK')}`;
}
