/**
 * Money utilities. We store every amount as integer halalas (1 SAR = 100 halalas).
 * Never use floats for money — banker's rounding is enforced on the boundary only.
 */
export type Halalas = number;

export const SAR_TO_HALALAS = 100;

export function sarToHalalas(sar: number): Halalas {
  // banker's rounding (round-half-even) to avoid systematic bias
  const x = sar * SAR_TO_HALALAS;
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function halalasToSar(halalas: Halalas): number {
  return halalas / SAR_TO_HALALAS;
}

export function formatSAR(halalas: Halalas, locale: 'ar' | 'en' = 'en'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(halalasToSar(halalas));
}
