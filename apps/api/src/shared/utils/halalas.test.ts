import { describe, expect, it } from 'vitest';

import { formatSAR, halalasToSar, sarToHalalas } from './halalas.js';

describe('halalas', () => {
  it('round-trips integer values', () => {
    expect(halalasToSar(sarToHalalas(12.34))).toBeCloseTo(12.34, 2);
    expect(sarToHalalas(0)).toBe(0);
    expect(sarToHalalas(1)).toBe(100);
  });

  it('uses bankers rounding on halves', () => {
    // 0.005 SAR == 0.5 halala → round to even (0)
    expect(sarToHalalas(0.005)).toBe(0);
    // 0.015 SAR == 1.5 halala → round to even (2)
    expect(sarToHalalas(0.015)).toBe(2);
  });

  it('formats SAR with locale', () => {
    const out = formatSAR(15750, 'en');
    expect(out).toMatch(/SAR/);
    expect(out).toMatch(/157\.50/);
  });
});
