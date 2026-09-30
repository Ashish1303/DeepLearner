export const authConfig = {
  argon2: { memoryCost: 65536, timeCost: 3, parallelism: 1, hashLength: 32 },
  accessLifetimeSeconds: 900,
  sessionLifetimeMs: 30 * 24 * 60 * 60 * 1000,
  tokenLifetimeMs: 15 * 60 * 1000,
  emailTimeoutMs: 1500,
  emailRetryDelayMs: 100,
  resendResponseFloorMs: 3500,
} as const;
