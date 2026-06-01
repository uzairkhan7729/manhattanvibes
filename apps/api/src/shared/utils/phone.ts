/**
 * E.164 phone helpers. Currently anchors on +92 (Pakistan, 3-digit dial code).
 * Falls back to a best-effort split for other origins. When we expand markets
 * we'll swap this for libphonenumber-js.
 */

const PK_PREFIX = '+92';

export interface ParsedPhone {
  countryCode: string;
  number: string;
}

export function parseE164(e164: string): ParsedPhone {
  if (e164.startsWith(PK_PREFIX)) {
    return { countryCode: PK_PREFIX, number: e164.slice(PK_PREFIX.length) };
  }
  // best-effort fallback
  return { countryCode: e164.slice(0, 4), number: e164.slice(4) };
}

export function formatE164(p: ParsedPhone): string {
  return `${p.countryCode}${p.number}`;
}
