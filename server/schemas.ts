import { z } from 'zod';

export const riskPreferenceSchema = z.enum(['aggressive', 'balanced', 'conservative']);

export const candidateInputSchema = z.object({
  province: z.string(),
  year: z.number().int().min(2000).max(2100),
  track: z.string(),
  score: z.number().min(0).max(750).optional(),
  rank: z.number().int().min(1).max(2_000_000).optional(),
  batchLine: z.number().min(0).max(750).optional(),
  targetMajor: z.string(),
  preferredCities: z.array(z.string()),
  preferredTiers: z.array(z.string()),
  riskPreference: riskPreferenceSchema,
  acceptsAdjustment: z.boolean(),
  specialTypes: z.object({
    sinoForeign: z.boolean(),
    localPlan: z.boolean(),
    earlyBatch: z.boolean(),
  }),
});

export const admissionRecordSchema = z.object({
  id: z.string().min(1),
  university: z.string().min(1),
  major: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  sourceProvince: z.string().min(1),
  admissionType: z.enum(['regular', 'early', 'local']).default('regular'),
  tier: z.string().min(1),
  category: z.string().min(1),
  publicSchool: z.boolean(),
  doubleFirstClass: z.boolean(),
  tuition: z.number().int().min(0),
  subjectRequirement: z.string().min(1),
  plan2026: z.number().int().min(0),
  planDelta: z.number().int(),
  minScores: z.record(z.string(), z.number()),
  minRanks: z.record(z.string(), z.number()),
  restrictions: z.array(z.string()),
  source: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const importAdmissionsSchema = z.object({
  records: z.array(z.unknown()).min(1),
});

export const reportRequestSchema = z.object({
  input: candidateInputSchema,
  candidateIds: z.array(z.string()).optional().default([]),
});
