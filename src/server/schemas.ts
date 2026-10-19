import { z } from 'zod';
import { locales, defaultLocale } from '@/i18n/config';

export const localeSchema = z
  .string()
  .optional()
  .transform((v) => ((locales as readonly string[]).includes(v ?? '') ? (v as (typeof locales)[number]) : defaultLocale));

export const playerIdSchema = z.string().uuid();
export const questionIdSchema = z.number().int().positive().max(2_147_483_647);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const todayQuery = z.object({
  locale: localeSchema,
  player: playerIdSchema.optional(),
});

export const puzzleQuery = z.object({
  locale: localeSchema,
  player: playerIdSchema,
  number: z.coerce.number().int().min(0).max(100_000).optional(),
});

export const archiveQuery = z.object({
  locale: localeSchema,
  player: playerIdSchema,
  before: z.coerce.number().int().min(0).max(100_000).optional(),
});

export const voteBody = z.object({
  questionId: questionIdSchema,
  playerId: playerIdSchema,
  answer: z.boolean(),
  locale: localeSchema,
  turnstileToken: z.string().max(4096).optional(),
});

export const guessBody = z.object({
  questionId: questionIdSchema,
  playerId: playerIdSchema,
  value: z.number().int().min(0).max(100),
  locale: localeSchema,
});

export const SUGGESTION_MIN = 8;
export const SUGGESTION_MAX = 120;

export const suggestBody = z.object({
  text: z.string().max(1000),
  nickname: z.string().max(100).default(''),
  locale: localeSchema,
  website: z.string().max(500).default(''), // honeypot: humans leave it empty
});

const translationSchema = z.object({
  text: z.string().max(200),
  reviewed: z.boolean(),
});

export const adminBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('dashboard'), from: dateSchema, days: z.number().int().min(1).max(120).optional() }),
  z.object({
    action: z.literal('questions'),
    status: z.enum(['draft', 'scheduled', 'live', 'closed', 'void']).optional(),
    search: z.string().max(100).optional(),
  }),
  z.object({
    action: z.literal('saveQuestion'),
    id: questionIdSchema.nullable().optional(),
    translations: z.record(z.string().max(10), translationSchema),
    minVotes: z.number().int().min(1).max(1_000_000).optional(),
  }),
  z.object({ action: z.literal('schedule'), id: questionIdSchema, date: dateSchema }),
  z.object({ action: z.literal('unschedule'), id: questionIdSchema }),
  z.object({ action: z.literal('void'), id: questionIdSchema }),
  z.object({ action: z.literal('delete'), id: questionIdSchema }),
  z.object({ action: z.literal('stats'), id: questionIdSchema }),
  z.object({ action: z.literal('submissions'), status: z.enum(['pending', 'approved', 'rejected']).optional() }),
  z.object({
    action: z.literal('reviewSubmission'),
    id: questionIdSchema,
    decision: z.enum(['approve', 'reject']),
    text: z.string().max(200).optional(),
  }),
]);

export type AdminBody = z.infer<typeof adminBody>;
