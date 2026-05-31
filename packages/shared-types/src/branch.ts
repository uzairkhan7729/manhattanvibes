import type { Id, Iso8601, I18nText, GeoPolygon, Halalas } from './common.js';
import type { Address } from './user.js';

export type BranchStatus = 'active' | 'paused' | 'closed';

export interface OpeningHours {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  open: string;  // 'HH:mm'
  close: string; // 'HH:mm'
}

export interface DeliveryZone {
  name: string;
  polygon: GeoPolygon;
  minOrder: Halalas;
  deliveryFee: Halalas;
  etaMinutes: number;
}

export interface Branch {
  _id: Id;
  tenantId: Id;
  code: string;
  name: I18nText;
  address: Address;
  geofence: GeoPolygon;
  deliveryZones: DeliveryZone[];
  openingHours: OpeningHours[];
  contact: { phone: string; email?: string };
  taxId: string;
  zatcaSerialPrefix: string;
  features: { dineIn: boolean; pickup: boolean; delivery: boolean; takeaway: boolean };
  status: BranchStatus;
  managerUserId?: Id;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}
