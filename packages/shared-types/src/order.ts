import type { Id, Iso8601, Halalas } from './common.js';
import type { SizeCode } from './product.js';

export type OrderState =
  | 'CREATED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'BAKING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'REFUNDED';

export type OrderChannel = 'pos' | 'web' | 'mobile' | 'phone' | 'aggregator';
export type OrderType = 'dinein' | 'takeaway' | 'delivery' | 'pickup';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'failed';

export type ModifierType = 'sauce' | 'cheese' | 'topping' | 'addon';

export interface OrderModifier {
  type: ModifierType;
  toppingId?: Id;
  productId?: Id;
  qty: number;
  unitPrice: Halalas;
}

export interface OrderItem {
  _id?: Id;
  productId: Id;
  productSnapshot: Record<string, unknown>;
  qty: number;
  sizeCode?: SizeCode;
  crustCode?: string;
  modifiers: OrderModifier[];
  unitPrice: Halalas;
  lineTotal: Halalas;
  notes?: string;
  state?: 'pending' | 'preparing' | 'ready' | 'served';
}

export interface OrderPricing {
  subtotal: Halalas;
  discountTotal: Halalas;
  discountBreakdown: Array<{ source: 'coupon' | 'loyalty' | 'manual'; amount: Halalas; ref?: string }>;
  deliveryFee: Halalas;
  vatRate: number;
  vat: Halalas;
  tip: Halalas;
  total: Halalas;
}

export interface Order {
  _id: Id;
  tenantId: Id;
  branchId: Id;
  orderNumber: string;
  channel: OrderChannel;
  type: OrderType;
  customerId?: Id;
  tableId?: Id;
  state: OrderState;
  items: OrderItem[];
  pricing: OrderPricing;
  payments: Id[];
  paymentStatus: PaymentStatus;
  promoCodes: string[];
  notes?: string;
  clientOpId?: string;
  syncedAt?: Iso8601;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}
