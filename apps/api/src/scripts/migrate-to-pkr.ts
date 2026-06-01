/**
 * One-time migration: convert all monetary fields from SAR-sized halalas to
 * PKR-sized paisa by multiplying by `FACTOR`. Run AFTER you back up the DB.
 *
 *   npm run migrate-to-pkr --workspace=@mv/api
 *
 * Idempotency: we set a tenant-scoped flag in a `Meta` collection so re-running
 * is a no-op. To force a re-run, delete the meta doc and run again.
 *
 * What gets multiplied:
 *   - Product.basePrice and size/crust priceDeltas
 *   - Topping.basePrice
 *   - Order.pricing.{ subtotal, discountTotal, deliveryFee, vat, tip, total }
 *   - Order.pricing.discountBreakdown[].amount
 *   - Order.items[].unitPrice, lineTotal, modifiers[].unitPrice
 *   - Payment.amount, refunds[].amount
 *
 * Note: this is a multiplicative re-scaling, NOT a real FX conversion. Use it
 * once on a dev/staging DB seeded for SAR to make the numbers look reasonable
 * in PKR (Rs 1,050 instead of Rs 35 for a pizza). For a real production cutover
 * you would set prices manually.
 */
import { Schema, model, type Model } from 'mongoose';

import { logger } from '../infra/logger.js';
import { connectMongo, disconnectMongo } from '../infra/mongo.js';
import { OrderModel } from '../modules/orders/order.model.js';
import { PaymentModel } from '../modules/payments/payment.model.js';
import { ProductModel } from '../modules/catalog/models/product.model.js';
import { ToppingModel } from '../modules/catalog/models/topping.model.js';

const FACTOR = 30;
const META_KEY = 'currency-migration:sar-to-pkr-x30';

interface MetaDoc { _id?: unknown; key: string; appliedAt: Date }
const MetaSchema = new Schema<MetaDoc>({
  key: { type: String, required: true, unique: true },
  appliedAt: { type: Date, default: Date.now },
});
const MetaModel: Model<MetaDoc> = model<MetaDoc>('Meta', MetaSchema);

async function alreadyApplied(): Promise<boolean> {
  return !!(await MetaModel.findOne({ key: META_KEY }).exec());
}

async function migrateProducts(): Promise<void> {
  const products = await ProductModel.find({}).exec();
  for (const p of products) {
    if (typeof p.basePrice === 'number') p.basePrice = p.basePrice * FACTOR;
    if (Array.isArray(p.sizes)) {
      for (const s of p.sizes) {
        if (typeof s.priceDelta === 'number') s.priceDelta = s.priceDelta * FACTOR;
      }
    }
    if (Array.isArray(p.crusts)) {
      for (const c of p.crusts) {
        if (typeof c.priceDelta === 'number') c.priceDelta = c.priceDelta * FACTOR;
      }
    }
    await p.save();
  }
  logger.info({ count: products.length }, 'migrated products');
}

async function migrateToppings(): Promise<void> {
  const toppings = await ToppingModel.find({}).exec();
  for (const t of toppings) {
    if (typeof t.basePrice === 'number') t.basePrice = t.basePrice * FACTOR;
    await t.save();
  }
  logger.info({ count: toppings.length }, 'migrated toppings');
}

async function migrateOrders(): Promise<void> {
  const orders = await OrderModel.find({}).exec();
  for (const o of orders) {
    if (o.pricing) {
      const pr = o.pricing as Record<string, unknown>;
      for (const k of ['subtotal', 'discountTotal', 'deliveryFee', 'vat', 'tip', 'total']) {
        if (typeof pr[k] === 'number') pr[k] = (pr[k] as number) * FACTOR;
      }
      if (Array.isArray(pr.discountBreakdown)) {
        for (const d of pr.discountBreakdown as Array<Record<string, unknown>>) {
          if (typeof d.amount === 'number') d.amount = (d.amount as number) * FACTOR;
        }
      }
    }
    if (Array.isArray(o.items)) {
      for (const it of o.items) {
        if (typeof it.unitPrice === 'number') it.unitPrice = it.unitPrice * FACTOR;
        if (typeof it.lineTotal === 'number') it.lineTotal = it.lineTotal * FACTOR;
        if (Array.isArray(it.modifiers)) {
          for (const m of it.modifiers) {
            if (typeof m.unitPrice === 'number') m.unitPrice = m.unitPrice * FACTOR;
          }
        }
      }
    }
    o.markModified('pricing');
    o.markModified('items');
    await o.save();
  }
  logger.info({ count: orders.length }, 'migrated orders');
}

async function migratePayments(): Promise<void> {
  const payments = await PaymentModel.find({}).exec();
  for (const p of payments) {
    if (typeof p.amount === 'number') p.amount = p.amount * FACTOR;
    if (Array.isArray(p.refunds)) {
      for (const r of p.refunds) {
        if (typeof r.amount === 'number') r.amount = r.amount * FACTOR;
      }
    }
    p.currency = 'PKR';
    await p.save();
  }
  logger.info({ count: payments.length }, 'migrated payments');
}

async function main(): Promise<void> {
  await connectMongo();
  if (await alreadyApplied()) {
    logger.info(`migration "${META_KEY}" already applied — nothing to do`);
    await disconnectMongo();
    return;
  }

  logger.info({ factor: FACTOR }, 'starting SAR→PKR re-scale migration');
  await migrateProducts();
  await migrateToppings();
  await migrateOrders();
  await migratePayments();

  await MetaModel.create({ key: META_KEY, appliedAt: new Date() });
  await disconnectMongo();
  logger.info('migration complete');
}

void main().catch((err: unknown) => {
  logger.error({ err }, 'migrate-to-pkr failed');
  process.exit(1);
});
