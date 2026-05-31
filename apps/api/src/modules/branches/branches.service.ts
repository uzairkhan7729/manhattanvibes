import { Types } from 'mongoose';

import { ConflictError, NotFoundError } from '../../shared/errors/index.js';

import { BranchModel, type BranchDoc } from './branch.model.js';

const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

export async function listBranches(tenantId: string): Promise<BranchDoc[]> {
  return BranchModel.find({ tenantId: tid(tenantId) }).lean<BranchDoc[]>().exec();
}

export async function getBranch(tenantId: string, id: string): Promise<BranchDoc> {
  const doc = await BranchModel.findOne({ _id: tid(id), tenantId: tid(tenantId) }).exec();
  if (!doc) throw new NotFoundError('Branch');
  return doc;
}

export async function getBranchByCode(tenantId: string, code: string): Promise<BranchDoc | null> {
  return BranchModel.findOne({ tenantId: tid(tenantId), code }).exec();
}

export async function createBranch(tenantId: string, input: Partial<BranchDoc> & { code: string; name: { en: string }; address: { line1: string; city: string; district: string; lat: number; lng: number }; contact: { phone: string }; taxId: string; zatcaSerialPrefix: string }): Promise<BranchDoc> {
  const dupe = await BranchModel.exists({ tenantId: tid(tenantId), code: input.code });
  if (dupe) throw new ConflictError('branch-code-exists', `Code "${input.code}" already in use`);
  return BranchModel.create({ ...input, tenantId: tid(tenantId) });
}

export async function updateBranch(tenantId: string, id: string, patch: Partial<BranchDoc>): Promise<BranchDoc> {
  const doc = await BranchModel.findOneAndUpdate({ _id: tid(id), tenantId: tid(tenantId) }, { $set: patch }, { new: true }).exec();
  if (!doc) throw new NotFoundError('Branch');
  return doc;
}

/**
 * Atomically allocate the next order number for a branch. Resets at KSA midnight.
 * Format: `<branchCode>-<n>` (zero-padded to 5). Globally unique by (branchId, orderNumber).
 */
export async function nextOrderNumber(branchId: string): Promise<string> {
  const ymd = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }).replace(/-/g, '');
  // First, attempt counter advance only if we're in the same day. If day changed, reset to 1.
  const updated = await BranchModel.findOneAndUpdate(
    { _id: tid(branchId), 'orderSeq.ymd': ymd },
    { $inc: { 'orderSeq.n': 1 } },
    { new: true },
  ).exec();
  if (updated) {
    return `${updated.code}-${String(updated.orderSeq?.n ?? 0).padStart(5, '0')}`;
  }
  const reset = await BranchModel.findOneAndUpdate(
    { _id: tid(branchId) },
    { $set: { 'orderSeq.ymd': ymd, 'orderSeq.n': 1 } },
    { new: true },
  ).exec();
  if (!reset) throw new NotFoundError('Branch');
  return `${reset.code}-${String(reset.orderSeq?.n ?? 1).padStart(5, '0')}`;
}
