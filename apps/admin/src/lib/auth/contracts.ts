import { z } from 'zod';

const id = z.string().regex(/^[a-f0-9]{24}$/);
const name = z.string().trim().min(1).max(80);
const email = z.email().max(254);
const role = z.enum(['STUDENT', 'ADMIN']);
const plan = z.enum(['FREE', 'PREMIUM']);
const status = z.enum([
  'ACTIVE',
  'PENDING_VERIFICATION',
  'DISABLED',
  'SUSPENDED',
]);
const profile = z.strictObject({
  experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  learningGoals: z
    .array(
      z.enum([
        'LEARN_FROM_SCRATCH',
        'INTERVIEW_PREPARATION',
        'QUICK_REVISION',
        'MASTER_TECHNOLOGY',
        'STRENGTHEN_WEAK_AREAS',
      ]),
    )
    .max(5)
    .refine((values) => new Set(values).size === values.length),
  interestedTechnologyIds: z
    .array(id)
    .max(50)
    .refine((values) => new Set(values).size === values.length),
  preferredDifficulty: z
    .enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'INTERVIEW_READY'])
    .optional(),
  dailyStudyGoalMinutes: z.number().int().min(5).max(240).optional(),
});
export const currentUserSchema = z.strictObject({
  id,
  firstName: name,
  lastName: name,
  email,
  emailVerified: z.boolean(),
  role,
  plan,
  status,
  authMethods: z
    .array(z.enum(['PASSWORD', 'GOOGLE']))
    .min(1)
    .max(2)
    .refine((values) => new Set(values).size === values.length),
  profile: profile.nullable(),
  createdAt: z.iso.datetime(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
const accessFields = {
  accessToken: z
    .string()
    .min(1)
    .max(8192)
    .regex(/^[A-Za-z0-9_.-]+$/),
  expiresInSeconds: z.literal(900),
};
export const refreshSchema = z.strictObject(accessFields);
export const loginSchema = z.strictObject({
  ...accessFields,
  user: z.strictObject({
    id,
    firstName: name,
    lastName: name,
    email,
    role,
    plan,
    status: z.literal('ACTIVE'),
  }),
});
export type Access = z.infer<typeof refreshSchema>;
export type Login = z.infer<typeof loginSchema>;
export function successEnvelope<T extends z.ZodType>(data: T) {
  return z.strictObject({
    success: z.literal(true),
    data,
    message: z.string().max(4096).nullable(),
    meta: z.strictObject({ requestId: z.string().min(1).max(128) }),
  });
}
export const errorEnvelope = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.string().min(1).max(128),
    message: z.string().max(4096),
    details: z
      .array(
        z.strictObject({
          field: z.string().max(256),
          message: z.string().max(4096),
        }),
      )
      .max(64)
      .optional(),
  }),
  meta: z.strictObject({ requestId: z.string().min(1).max(128) }),
});
export const loginInput = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(email),
  password: z.string().min(10).max(128),
});
export type AdminIdentity = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN';
  status: 'ACTIVE';
  emailVerified: true;
}>;
export function projectAdmin(raw: unknown): AdminIdentity | null {
  const result = currentUserSchema.safeParse(raw);
  if (!result.success) return null;
  const user = result.data;
  if (user.role !== 'ADMIN' || user.status !== 'ACTIVE' || !user.emailVerified)
    return null;
  return Object.freeze({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: 'ADMIN',
    status: 'ACTIVE',
    emailVerified: true,
  });
}
