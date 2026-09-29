import { argon2id, hash } from 'argon2';
import { authConfig } from '../../config/auth.js';

export function hashPassword(password: string): Promise<string> {
  return hash(password, { ...authConfig.argon2, type: argon2id });
}
