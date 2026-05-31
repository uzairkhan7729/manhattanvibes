import { z } from 'zod';

import { localeSchema, phoneSchema } from './common.js';

/**
 * Password policy (OWASP ASVS-aligned):
 *   - 10..72 chars (bcrypt's 72-byte limit)
 *   - at least one letter and one digit
 */
export const passwordSchema = z
  .string()
  .min(10, 'password must be at least 10 characters')
  .max(72, 'password too long')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'password must include letters and digits');

export const registerSchema = z.object({
  fullName: z.object({ ar: z.string().min(1).optional(), en: z.string().min(1) }),
  phone: phoneSchema,
  email: z.string().email().optional(),
  password: passwordSchema.optional(), // optional — OTP-first registration is allowed
  preferredLanguage: localeSchema.default('ar'),
  marketingOptIn: z.boolean().default(false),
});

export const loginSchema = z.object({
  identifier: z.union([phoneSchema, z.string().email()]),
  password: z.string().min(1),
});

export const otpRequestSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['login', 'register', 'verify', 'reset']),
});

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  purpose: z.enum(['login', 'register', 'verify', 'reset']),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const passwordForgotSchema = z.object({
  identifier: z.union([phoneSchema, z.string().email()]),
});

export const passwordResetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
