/**
 * E.164 phone helpers. Phase 1 is KSA-only — we anchor on +966 and treat
 * everything else as a best-effort 4-char country-code split. When Phase 2
 * adds GCC markets we'll swap this for libphonenumber-js.
 */

const KSA_PREFIX = '+966';

export interface ParsedPhone {
  countryCode: string;
  number: string;
}

export function parseE164(e164: string): ParsedPhone {
  if (e164.startsWith(KSA_PREFIX)) {
    return { countryCode: KSA_PREFIX, number: e164.slice(KSA_PREFIX.length) };
  }
  // best-effort fallback
  return { countryCode: e164.slice(0, 4), number: e164.slice(4) };
}

export function formatE164(p: ParsedPhone): string {
  return `${p.countryCode}${p.number}`;
}
