import { z } from 'zod';
import { normalizedEmail } from './auth.schema.js';
import { AppError } from '../../common/errors/app-error.js';

export const passwordPolicyError = () =>
  new AppError(
    400,
    'AUTH_PASSWORD_POLICY_FAILED',
    'Password does not meet policy',
  );
export function validateNewPassword(value: string) {
  if (value.length < 10 || value.length > 128) throw passwordPolicyError();
}
const request = <S extends z.ZodType>(body: S) =>
  z.strictObject({
    body,
    params: z.strictObject({}),
    query: z.strictObject({}),
  });
export const forgotPasswordRequest = request(
  z.strictObject({ email: normalizedEmail }),
);
// Policy and token-format errors use their canonical domain codes after type validation.
export const resetPasswordRequest = request(
  z.strictObject({ token: z.string(), newPassword: z.string() }),
);
export const changePasswordRequest = request(
  z.strictObject({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string(),
  }),
);
