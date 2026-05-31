/**
 * Notifications — templates, send dispatch, device tokens.
 *
 * Channels (Phase 1): push, sms, email, whatsapp.
 * Providers (Phase 1): console-log (dev/test) for all channels. Real adapters
 * (Expo, Unifonic, SES, 360dialog) plug in via the `ChannelProvider` interface.
 *
 * Dispatch is synchronous in Phase 1; Phase 2 routes through BullMQ
 * (notification.worker) with retries + per-channel rate limiting.
 */
import { Router, type Request, type Response } from 'express';
import { Schema, Types, model, type InferSchemaType, type Model } from 'mongoose';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { logger } from '../../infra/logger.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

type Channel = 'push' | 'sms' | 'email' | 'whatsapp';
type Locale = 'ar' | 'en';

// ── Models ────────────────────────────────────────────────────────────────
const TemplateSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    key:      { type: String, required: true },
    channel:  { type: String, enum: ['push', 'sms', 'email', 'whatsapp'], required: true },
    locale:   { type: String, enum: ['ar', 'en'], required: true },
    subject:  { type: String },
    body:     { type: String, required: true },
    vars:     [{ type: String }],
    isTransactional: { type: Boolean, default: true },
  },
  { timestamps: true },
);
TemplateSchema.index({ tenantId: 1, key: 1, channel: 1, locale: 1 }, { unique: true });
type TemplateDoc = InferSchemaType<typeof TemplateSchema> & { _id: Types.ObjectId };
const TemplateModel: Model<TemplateDoc> = model<TemplateDoc>('NotificationTemplate', TemplateSchema);

const DeviceSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId:   { type: Schema.Types.ObjectId, required: true, index: true },
    token:    { type: String, required: true, unique: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
    locale:   { type: String, enum: ['ar', 'en'], default: 'ar' },
    appVersion: { type: String },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
type DeviceDoc = InferSchemaType<typeof DeviceSchema> & { _id: Types.ObjectId };
const DeviceModel: Model<DeviceDoc> = model<DeviceDoc>('NotificationDevice', DeviceSchema);

const OutboxSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
    channel:     { type: String, enum: ['push', 'sms', 'email', 'whatsapp'], required: true },
    recipient:   { type: String, required: true },
    templateKey: { type: String, required: true },
    locale:      { type: String, enum: ['ar', 'en'], default: 'ar' },
    vars:        { type: Schema.Types.Mixed },
    status:      { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
    providerRef: { type: String },
    error:       { type: String },
    ts:          { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);
type OutboxDoc = InferSchemaType<typeof OutboxSchema> & { _id: Types.ObjectId };
const OutboxModel: Model<OutboxDoc> = model<OutboxDoc>('NotificationOutbox', OutboxSchema);

const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

// ── Variable substitution (Liquid-lite: {{key}}) ──────────────────────────
function render(template: string, vars: Record<string, unknown>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, k) => {
    const v = vars[k];
    return v == null ? '' : String(v);
  });
}

// ── Channel providers ─────────────────────────────────────────────────────
interface SendResult { ok: boolean; providerRef?: string; error?: string }
interface ChannelProvider {
  send(recipient: string, subject: string | undefined, body: string): Promise<SendResult>;
}

const consoleProvider: ChannelProvider = {
  async send(recipient, subject, body) {
    logger.info({ recipient, subject, body }, '[NOTIFY:console] message');
    return { ok: true, providerRef: 'console' };
  },
};

const providers: Record<Channel, ChannelProvider> = {
  push: consoleProvider,
  sms: consoleProvider,
  email: consoleProvider,
  whatsapp: consoleProvider,
};

// ── Public API ────────────────────────────────────────────────────────────
export interface SendInput {
  tenantId: string;
  recipient: string;         // E.164 phone, email address, or device token
  channel: Channel;
  templateKey: string;
  locale?: Locale;
  vars?: Record<string, unknown>;
}

export async function sendNotification(input: SendInput): Promise<OutboxDoc> {
  const tpl = await TemplateModel.findOne({
    tenantId: tid(input.tenantId), key: input.templateKey, channel: input.channel,
    locale: input.locale ?? 'ar',
  }).exec();

  let body = `[Missing template ${input.templateKey}]`;
  let subject: string | undefined;
  if (tpl) {
    body = render(tpl.body, input.vars ?? {});
    subject = tpl.subject ? render(tpl.subject, input.vars ?? {}) : undefined;
  }

  const outbox = await OutboxModel.create({
    tenantId: tid(input.tenantId),
    channel: input.channel, recipient: input.recipient, templateKey: input.templateKey,
    locale: input.locale ?? 'ar', vars: input.vars, status: 'queued',
  });

  try {
    const result = await providers[input.channel].send(input.recipient, subject, body);
    outbox.status = result.ok ? 'sent' : 'failed';
    outbox.providerRef = result.providerRef;
    outbox.error = result.error;
  } catch (err: unknown) {
    outbox.status = 'failed';
    outbox.error = err instanceof Error ? err.message : String(err);
  }
  await outbox.save();
  return outbox;
}

// ── Routes ────────────────────────────────────────────────────────────────
export const notificationsRouter: Router = Router();

notificationsRouter.get('/templates', requireAuth, requirePermission('campaigns:read'),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ items: await TemplateModel.find({ tenantId: tid(req.tenantId) }).lean().exec() });
  }));

const upsertTemplateSchema = z.object({
  key: z.string().min(1),
  channel: z.enum(['push', 'sms', 'email', 'whatsapp']),
  locale: z.enum(['ar', 'en']),
  subject: z.string().optional(),
  body: z.string().min(1),
  vars: z.array(z.string()).optional(),
  isTransactional: z.boolean().optional(),
});
notificationsRouter.post('/templates', requireAuth, requirePermission('campaigns:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = upsertTemplateSchema.parse(req.body);
    const doc = await TemplateModel.findOneAndUpdate(
      { tenantId: tid(req.tenantId), key: input.key, channel: input.channel, locale: input.locale },
      { $set: input },
      { upsert: true, new: true },
    ).exec();
    res.json(doc);
  }));

const deviceSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  locale: z.enum(['ar', 'en']).optional(),
  appVersion: z.string().optional(),
});
notificationsRouter.post('/devices', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const input = deviceSchema.parse(req.body);
  if (!req.auth) throw new NotFoundError('User');
  const doc = await DeviceModel.findOneAndUpdate(
    { token: input.token },
    { $set: { ...input, tenantId: tid(req.tenantId), userId: tid(req.auth.userId), lastSeenAt: new Date() } },
    { upsert: true, new: true },
  ).exec();
  res.json(doc);
}));

notificationsRouter.delete('/devices/:token', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  await DeviceModel.deleteOne({ token: req.params.token });
  res.status(204).end();
}));

const testSendSchema = z.object({
  channel: z.enum(['push', 'sms', 'email', 'whatsapp']),
  recipient: z.string().min(1),
  templateKey: z.string().min(1),
  locale: z.enum(['ar', 'en']).optional(),
  vars: z.record(z.unknown()).optional(),
});
notificationsRouter.post('/test', requireAuth, requirePermission('campaigns:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = testSendSchema.parse(req.body);
    res.json(await sendNotification({ ...input, tenantId: req.tenantId }));
  }));
