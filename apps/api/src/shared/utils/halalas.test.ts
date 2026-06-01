import { describe, expect, it } from 'vitest';

import { formatSAR, halalasToSar, sarToHalalas } from './halalas.js';

describe('paisa (historically halalas)', () => {
  it('round-trips integer values', () => {
    expect(halalasToSar(sarToHalalas(12.34))).toBeCloseTo(12.34, 2);
    expect(sarToHalalas(0)).toBe(0);
    expect(sarToHalalas(1)).toBe(100);
  });

  it('uses bankers rounding on halves', () => {
    // 0.005 PKR == 0.5 paisa → round to even (0)
    expect(sarToHalalas(0.005)).toBe(0);
    // 0.015 PKR == 1.5 paisa → round to even (2)
    expect(sarToHalalas(0.015)).toBe(2);
  });

  it('formats paisa as PKR', () => {
    // 157.50 PKR → 'Rs 158' (no decimals; values are pre-rounded for display)
    const out = formatSAR(15750, 'en');
    expect(out).toMatch(/Rs/);
    expect(out).toMatch(/158/);
  });
});
