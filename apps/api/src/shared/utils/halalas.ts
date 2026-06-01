/**
 * Money utilities. We store every amount as integer paisa (1 PKR = 100 paisa).
 *
 * Type and helper names are still `Halalas`/`sarToHalalas` for historical
 * reasons (the system was originally built for SAR). The math is identical
 * between halalas and paisa — both are 1/100 of the major unit — so we keep
 * the names to avoid a sweeping rename across the codebase.
 *
 * Never use floats for money — banker's rounding is enforced on the boundary only.
 */
export type Halalas = number;

export const SAR_TO_HALALAS = 100;

/** Convert a major unit (now PKR rupees, historically SAR) to paisa/halalas. */
export function sarToHalalas(rupees: number): Halalas {
  // banker's rounding (round-half-even) to avoid systematic bias
  const x = rupees * SAR_TO_HALALAS;
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Convert paisa/halalas back to the major unit (now PKR rupees). */
export function halalasToSar(halalas: Halalas): number {
  return halalas / SAR_TO_HALALAS;
}

/**
 * Format paisa as a PKR string. Historically named formatSAR; outputs
 * `Rs 1,234` with no decimal places (PKR is consumer-priced in whole rupees).
 */
export function formatSAR(paisa: Halalas, _locale: 'ar' | 'en' = 'en'): string {
  const rupees = Math.round(paisa / 100);
  return `Rs ${rupees.toLocaleString('en-PK')}`;
}
