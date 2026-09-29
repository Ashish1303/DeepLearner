import type { ClientSession, Types } from 'mongoose';
import { Audit } from './audit.model.js';

export async function appendAuthAudit(
  action: 'AUTH_REGISTERED' | 'AUTH_EMAIL_VERIFIED',
  userId: Types.ObjectId,
  requestId: string,
  session: ClientSession,
) {
  await Audit.create(
    [
      {
        category: 'AUTH',
        action,
        actorId: userId,
        resourceType: 'USER',
        resourceId: userId,
        requestId,
        metadata: { source: 'EMAIL_PASSWORD' },
      },
    ],
    { session },
  );
}
