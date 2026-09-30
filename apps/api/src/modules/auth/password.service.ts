import { argon2id, hash, verify } from 'argon2';
import { authConfig } from '../../config/auth.js';

export function hashPassword(password: string): Promise<string> {
  return hash(password, { ...authConfig.argon2, type: argon2id });
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return (
      passwordHash.startsWith('$argon2id$') &&
      (await verify(passwordHash, password))
    );
  } catch {
    return false;
  }
}
