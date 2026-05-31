import { z } from 'zod';

/** E.164 phone number, normalized: leading '+' then 8–15 digits. */
export const phoneSchema = z.string().regex(/^\+\d{8,15}$/, 'invalid E.164 phone');

/** ObjectId-shaped string (24 hex chars). */
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'invalid id');

export const localeSchema = z.enum(['ar', 'en']);

export const i18nTextSchema = z.object({
  ar: z.string().min(1).optional(),
  en: z.string().min(1),
});

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
