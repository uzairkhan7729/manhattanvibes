import { Types } from 'mongoose';

import { getIO } from '../../infra/socket.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import type { Halalas } from '../../shared/utils/halalas.js';
import { nextOrderNumber } from '../branches/branches.service.js';
import * as catalog from '../catalog/catalog.service.js';

import { OrderModel, type OrderDoc } from './order.model.js';
import { canTransition, isPastKitchenAccept, type OrderState } from './state-machine.js';

const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

// ──────────────────────────────────────────────────────────────────────────
// Quote
// ──────────────────────────────────────────────────────────────────────────

export interface QuoteItemInput {
  productId: string;
  qty: number;
  sizeCode?: 'S' | 'M' | 'L' | 'XL';
  crustCode?: string;
  toppingIds?: string[];
  sauceIds?: string[];
  addonProductIds?: { productId: string; qty: number }[];
  notes?: string;
}

export interface QuoteInput {
  branchId: string;
  channel: 'pos' | 'web' | 'mobile' | 'phone';
  type: 'dinein' | 'takeaway' | 'delivery' | 'pickup';
  items: QuoteItemInput[];
  promoCode?: string;
  loyaltyPoints?: number;
  deliveryFee?: Halalas;
  tip?: Halalas;
}

export interface QuoteLine {
  productId: string;
  qty: number;
  unitPrice: Halalas;
  lineTotal: Halalas;
  modifiers: Array<{ type: 'sauce' | 'cheese' | 'topping' | 'addon'; toppingId?: string; productId?: string; qty: number; unitPrice: Halalas }>;
  sizeCode?: string;
  crustCode?: string;
  notes?: string;
  productSnapshot: { name: { ar?: string; en: string }; sku: string };
}

export interface QuoteResult {
  lines: QuoteLine[];
  subtotal: Halalas;
  discountTotal: Halalas;
  discountBreakdown: Array<{ source: 'coupon' | 'loyalty' | 'manual'; amount: Halalas; ref?: string }>;
  deliveryFee: Halalas;
  vatRate: number;
  vat: Halalas;
  tip: Halalas;
  total: Halalas;
}

/**
 * Authoritative cart pricing. Uses 15% VAT-inclusive rule per KSA:
 *   - line prices are tax-inclusive
 *   - VAT amount = subtotal * (rate / (100 + rate))
 *
 * Discounts (coupon, loyalty) and delivery fee are applied to net then VAT
 * is recomputed on the discounted gross. Future iteration will plug in the
 * promotions module — for now we treat promoCode as opaque (no engine yet).
 */
export async function quote(tenantId: string, input: QuoteInput): Promise<QuoteResult> {
  if (input.items.length === 0) throw new ValidationError({ items: 'must contain at least one item' });

  const lines: QuoteLine[] = [];
  for (const it of input.items) {
    const priced = await catalog.priceProductLine(tenantId, {
      productId: it.productId,
      branchId: input.branchId,
      qty: it.qty,
      sizeCode: it.sizeCode,
      crustCode: it.crustCode,
      toppingIds: it.toppingIds,
      sauceIds: it.sauceIds,
      addonProductIds: it.addonProductIds,
    });

    const view = await catalog.getProduct(tenantId, it.productId, input.branchId);
    const modifiers: QuoteLine['modifiers'] = [
      ...priced.breakdown.sauces.map((s) => ({ type: 'sauce' as const, toppingId: s.toppingId, qty: 1, unitPrice: s.price })),
      ...priced.breakdown.toppings.map((t) => ({ type: 'topping' as const, toppingId: t.toppingId, qty: 1, unitPrice: t.price })),
      ...priced.breakdown.addons.map((a) => ({ type: 'addon' as const, productId: a.productId, qty: a.qty, unitPrice: a.price })),
    ];

    lines.push({
      productId: it.productId,
      qty: it.qty,
      unitPrice: priced.unitPrice,
      lineTotal: priced.lineTotal,
      modifiers,
      sizeCode: it.sizeCode,
      crustCode: it.crustCode,
      notes: it.notes,
      productSnapshot: { name: view.product.name as never, sku: view.product.sku },
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const deliveryFee = input.deliveryFee ?? 0;
  const tip = input.tip ?? 0;
  const vatRate = 15;

  const discountBreakdown: QuoteResult['discountBreakdown'] = [];
  let discountTotal = 0;

  // Loyalty redemption — 100 pts = 100 halalas (1 SAR). Capped at 50% of subtotal.
  if (input.loyaltyPoints && input.loyaltyPoints > 0) {
    const requested = input.loyaltyPoints * 1;     // halalas
    const cap = Math.floor(subtotal * 0.5);
    const applied = Math.min(requested, cap);
    if (applied > 0) {
      discountBreakdown.push({ source: 'loyalty', amount: applied });
      discountTotal += applied;
    }
  }

  // Coupon — placeholder until promotions module lands. Accept "TEST10" → 10% off.
  if (input.promoCode === 'TEST10') {
    const amount = Math.floor(subtotal * 0.1);
    discountBreakdown.push({ source: 'coupon', amount, ref: 'TEST10' });
    discountTotal += amount;
  }

  const grossAfterDisc = Math.max(0, subtotal - discountTotal) + deliveryFee + tip;
  const vat = Math.round((grossAfterDisc * vatRate) / (100 + vatRate));
  const total = grossAfterDisc;

  return { lines, subtotal, discountTotal, discountBreakdown, deliveryFee, vatRate, vat, tip, total };
}

// ──────────────────────────────────────────────────────────────────────────
// Place order
// ──────────────────────────────────────────────────────────────────────────

export interface PlaceOrderInput extends QuoteInput {
  customerId?: string;
  tableId?: string;
  guestInfo?: { name?: string; phone?: string };
  addressSnapshot?: Record<string, unknown>;
  clientOpId?: string;
}

export async function placeOrder(tenantId: string, input: PlaceOrderInput, actor: { userId?: string; role?: string; deviceId?: string }): Promise<OrderDoc> {
  // Idempotency on clientOpId (POS offline)
  if (input.clientOpId) {
    const existing = await OrderModel.findOne({ branchId: tid(input.branchId), clientOpId: input.clientOpId }).exec();
    if (existing) return existing;
  }

  const q = await quote(tenantId, input);
  const orderNumber = await nextOrderNumber(input.branchId);

  const created = await OrderModel.create({
    tenantId: tid(tenantId),
    branchId: tid(input.branchId),
    orderNumber,
    channel: input.channel,
    type: input.type,
    customerId: input.customerId ? tid(input.customerId) : undefined,
    tableId: input.tableId ? tid(input.tableId) : undefined,
    guestInfo: input.guestInfo,
    state: 'CREATED',
    items: q.lines.map((l) => ({
      productId: tid(l.productId),
      productSnapshot: l.productSnapshot,
      qty: l.qty,
      sizeCode: l.sizeCode,
      crustCode: l.crustCode,
      modifiers: l.modifiers.map((m) => ({
        type: m.type,
        toppingId: m.toppingId ? tid(m.toppingId) : undefined,
        productId: m.productId ? tid(m.productId) : undefined,
        qty: m.qty,
        unitPrice: m.unitPrice,
      })),
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      notes: l.notes,
      state: 'pending',
    })),
    pricing: {
      subtotal: q.subtotal,
      discountTotal: q.discountTotal,
      discountBreakdown: q.discountBreakdown,
      deliveryFee: q.deliveryFee,
      vatRate: q.vatRate,
      vat: q.vat,
      tip: q.tip,
      total: q.total,
    },
    delivery: input.type === 'delivery' ? { addressSnapshot: input.addressSnapshot } : undefined,
    promoCodes: input.promoCode ? [input.promoCode] : [],
    audit: { createdBy: actor.userId ? tid(actor.userId) : undefined, createdByRole: actor.role, deviceId: actor.deviceId, transitions: [] },
    clientOpId: input.clientOpId,
  });

  emitOrderEvent('order.created', created);
  return created;
}

// ──────────────────────────────────────────────────────────────────────────
// Transition state
// ──────────────────────────────────────────────────────────────────────────

export async function transition(tenantId: string, orderId: string, to: OrderState, actor: { userId?: string }, reason?: string): Promise<OrderDoc> {
  const doc = await OrderModel.findOne({ _id: tid(orderId), tenantId: tid(tenantId) }).exec();
  if (!doc) throw new NotFoundError('Order');
  const from = doc.state as OrderState;
  if (!canTransition(from, to)) {
    throw new ConflictError('state-transition-invalid', `Cannot move ${from} → ${to}`);
  }
  doc.state = to;
  doc.audit?.transitions?.push({ from, to, by: actor.userId ? tid(actor.userId) : undefined, ts: new Date(), reason });
  if (to === 'CLOSED' || to === 'DELIVERED') doc.closedAt = new Date();
  await doc.save();

  emitOrderEvent('order.state_changed', doc, { from, to });
  if (to === 'CONFIRMED') emitOrderEvent('order.confirmed', doc);
  if (to === 'READY')     emitOrderEvent('order.ready', doc);
  if (to === 'DELIVERED') emitOrderEvent('order.delivered', doc);
  if (to === 'CANCELLED') emitOrderEvent('order.cancelled', doc);

  return doc;
}

// ──────────────────────────────────────────────────────────────────────────
// Modify (pre-kitchen-accept only)
// ──────────────────────────────────────────────────────────────────────────

export async function modifyOrder(tenantId: string, orderId: string, patch: { items?: QuoteItemInput[]; notes?: string }): Promise<OrderDoc> {
  const doc = await OrderModel.findOne({ _id: tid(orderId), tenantId: tid(tenantId) }).exec();
  if (!doc) throw new NotFoundError('Order');
  if (isPastKitchenAccept(doc.state as OrderState)) {
    throw new ConflictError('state-transition-invalid', 'Cannot modify order after kitchen accepted — use refund instead');
  }
  if (patch.items) {
    const q = await quote(tenantId, {
      branchId: doc.branchId.toString(),
      channel: doc.channel as never,
      type: doc.type as never,
      items: patch.items,
    });
    doc.items = q.lines.map((l) => ({
      productId: tid(l.productId), productSnapshot: l.productSnapshot, qty: l.qty,
      sizeCode: l.sizeCode, crustCode: l.crustCode,
      modifiers: l.modifiers.map((m) => ({ type: m.type, toppingId: m.toppingId ? tid(m.toppingId) : undefined, productId: m.productId ? tid(m.productId) : undefined, qty: m.qty, unitPrice: m.unitPrice })),
      unitPrice: l.unitPrice, lineTotal: l.lineTotal, notes: l.notes, state: 'pending',
    })) as never;
    doc.pricing = { subtotal: q.subtotal, discountTotal: q.discountTotal, discountBreakdown: q.discountBreakdown, deliveryFee: q.deliveryFee, vatRate: q.vatRate, vat: q.vat, tip: q.tip, total: q.total } as never;
  }
  if (typeof patch.notes === 'string') doc.notes = patch.notes;
  await doc.save();
  emitOrderEvent('order.modified', doc);
  return doc;
}

// ──────────────────────────────────────────────────────────────────────────
// Cancel
// ──────────────────────────────────────────────────────────────────────────

export async function cancelOrder(tenantId: string, orderId: string, actor: { userId?: string; role?: string }, reason: string): Promise<OrderDoc> {
  const doc = await OrderModel.findOne({ _id: tid(orderId), tenantId: tid(tenantId) }).exec();
  if (!doc) throw new NotFoundError('Order');

  if (isPastKitchenAccept(doc.state as OrderState) && actor.role !== 'BranchManager' && actor.role !== 'SuperAdmin') {
    throw new ForbiddenError('Cancellation past kitchen-accept requires manager approval');
  }
  return transition(tenantId, orderId, 'CANCELLED', actor, reason);
}

// ──────────────────────────────────────────────────────────────────────────
// Reads
// ──────────────────────────────────────────────────────────────────────────

/**
 * Look up an order by either its Mongo ObjectId or its human-friendly
 * orderNumber (e.g. "RUH-1-00001"). Lets customers paste either into the
 * tracking URL.
 */
export async function getOrder(tenantId: string, idOrNumber: string): Promise<OrderDoc> {
  const looksLikeObjectId = /^[a-f0-9]{24}$/i.test(idOrNumber);
  const query = looksLikeObjectId
    ? { _id: tid(idOrNumber), tenantId: tid(tenantId) }
    : { orderNumber: idOrNumber, tenantId: tid(tenantId) };
  const doc = await OrderModel.findOne(query).exec();
  if (!doc) throw new NotFoundError('Order');
  return doc;
}

export async function listOrders(tenantId: string, opts: { branchId?: string; state?: OrderState; from?: Date; to?: Date; customerId?: string; limit?: number }): Promise<OrderDoc[]> {
  const q: Record<string, unknown> = { tenantId: tid(tenantId) };
  if (opts.branchId) q.branchId = tid(opts.branchId);
  if (opts.state) q.state = opts.state;
  if (opts.customerId) q.customerId = tid(opts.customerId);
  if (opts.from || opts.to) {
    q.createdAt = {
      ...(opts.from ? { $gte: opts.from } : {}),
      ...(opts.to ? { $lte: opts.to } : {}),
    };
  }
  return OrderModel.find(q).sort({ createdAt: -1 }).limit(opts.limit ?? 100).lean<OrderDoc[]>().exec();
}

// ──────────────────────────────────────────────────────────────────────────
// Socket.IO emission
// ──────────────────────────────────────────────────────────────────────────

function emitOrderEvent(event: string, order: OrderDoc, extra: Record<string, unknown> = {}): void {
  try {
    const io = getIO();
    const payload = {
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      branchId: order.branchId.toString(),
      state: order.state,
      type: order.type,
      total: order.pricing?.total,
      ...extra,
    };
    io.of('/kds').to(`branch:${order.branchId.toString()}:kitchen`).emit(event, payload);
    io.of('/admin').to(`branch:${order.branchId.toString()}:admin`).emit(event, payload);
    io.of('/tracking').to(`order:${order._id.toString()}`).emit(event, payload);
  } catch {
    // Socket.IO not initialised (e.g. unit tests) — silently skip.
  }
}
