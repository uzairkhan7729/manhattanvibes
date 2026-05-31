export type Id = string;
export type Iso8601 = string;
export type Locale = 'ar' | 'en';
export type Currency = 'SAR';

/** Localized text — Arabic + English. */
export interface I18nText {
  ar?: string;
  en: string;
}

/** All monetary amounts are integer halalas (1 SAR = 100 halalas). */
export type Halalas = number;

export interface Phone {
  countryCode: string;
  number: string;
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  totalCount?: number;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  fields?: Record<string, string>;
}
