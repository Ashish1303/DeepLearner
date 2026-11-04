import { z } from 'zod';
import { proposalContent } from './admin-learning-path-proposal.schema.js';

// Reuse C1 text/Unicode/duplicate bounds; do not normalize identities or content.
export const proposalRequestId = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
export const proposalOperationId = z
  .string()
  .regex(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/,
  );
export const proposalCaptureInput = z.strictObject({
  technologyId: proposalRequestId,
  operationId: proposalOperationId,
  ...proposalContent,
});
const query = z.strictObject({ technologyId: proposalRequestId });
const noBody = z.strictObject({}).optional();
export const proposalCaptureRequest = z.strictObject({
  params: z.strictObject({}),
  query: z.strictObject({}),
  body: proposalCaptureInput,
});
export const proposalRecoveryRequest = z.strictObject({
  params: z.strictObject({ operationId: proposalOperationId }),
  query,
  body: noBody,
});
export const proposalDetailRequest = z.strictObject({
  params: z.strictObject({ id: proposalRequestId }),
  query,
  body: noBody,
});

// Validate public output strictly too: private/internal fields must not be stripped.
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const proposalResponseDto = z.strictObject({
  id: proposalRequestId,
  proposalId: proposalRequestId,
  technologyId: proposalRequestId,
  revision: positive,
  schemaVersion: z.literal(1),
  ...proposalContent,
  source: z.strictObject({ id: proposalRequestId, revision: positive }),
  createdAt: z.string().refine((value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString() === value;
  }),
});
export const proposalRecoveryResponse = z.discriminatedUnion('state', [
  z.strictObject({
    state: z.literal('COMMITTED'),
    proposal: proposalResponseDto,
  }),
  z.strictObject({ state: z.literal('UNRESOLVED') }),
]);
export type ProposalCaptureInput = z.output<typeof proposalCaptureInput>;
