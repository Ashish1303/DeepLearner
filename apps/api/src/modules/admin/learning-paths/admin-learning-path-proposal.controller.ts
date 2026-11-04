import type { Request, Response } from 'express';
import type { AccessTokens } from '../../auth/access-token.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import { successResponse } from '../../../common/http/response.js';
import { technologyAuthority } from '../technologies/admin-technology.controller.js';
import { proposalData } from './admin-learning-path-proposal.schema.js';
import { proposalUnavailable } from './admin-learning-path-proposal.repository.js';
import {
  proposalResponseDto,
  proposalRecoveryResponse,
  type ProposalCaptureInput,
} from './admin-learning-path-proposal-request.schema.js';
import type {
  AdminLearningPathProposalService,
  ProposalAuthority,
} from './admin-learning-path-proposal.service.js';

const publicErrors: Record<string, readonly [number, string]> = {
  AUTH_ACCESS_TOKEN_MISSING: [401, 'Access token required'],
  AUTH_ACCESS_TOKEN_INVALID: [401, 'Access token is invalid or expired'],
  AUTH_ACCESS_TOKEN_EXPIRED: [401, 'Access token is invalid or expired'],
  AUTH_FORBIDDEN: [403, 'Admin access required'],
  VALIDATION_ERROR: [400, 'Invalid private proposal request'],
  TECHNOLOGY_NOT_FOUND: [404, 'Technology is unavailable'],
  PROPOSAL_NOT_FOUND: [404, 'Private proposal is unavailable'],
  TECHNOLOGY_READ_ONLY: [409, 'Technology is read-only'],
  PROPOSAL_CONFLICT: [409, 'Private proposal conflicts with current state'],
  DEPENDENCY_UNAVAILABLE: [
    503,
    'Private proposals are temporarily unavailable',
  ],
  PROPOSAL_OUTCOME_UNKNOWN: [
    503,
    'Save outcome is uncertain; use explicit read reconciliation',
  ],
};

export function createAdminLearningPathProposalController(
  service: AdminLearningPathProposalService,
  tokens: Pick<AccessTokens, 'verify'>,
) {
  async function send(
    req: Request,
    res: Response,
    execute: (authority: ProposalAuthority) => Promise<unknown>,
    technologyId: string,
    kind: 'capture' | 'recovery' | 'detail',
    id?: string,
  ) {
    const resource = technologyAuthority(req, res, tokens);
    try {
      const raw = await execute(resource.authority);
      if (resource.authority.signal?.aborted || req.aborted || res.destroyed)
        return;
      let data;
      try {
        const value = proposalData(raw);
        if (kind === 'recovery') data = proposalRecoveryResponse.parse(value);
        else data = proposalResponseDto.parse(value);
        const row =
          'state' in data
            ? data.state === 'COMMITTED'
              ? data.proposal
              : null
            : data;
        if (
          row &&
          (row.technologyId !== technologyId ||
            row.proposalId !== row.source.id ||
            row.source.revision !== 1 ||
            row.id === row.source.id ||
            (kind !== 'detail' && row.revision !== 1) ||
            (kind === 'detail' && row.id !== id))
        )
          throw proposalUnavailable();
      } catch {
        throw proposalUnavailable();
      }
      res.status(200).json(successResponse(data, req.requestId));
    } catch (error) {
      // Services are trusted, but even an unexpected throw must not leak internals.
      if (
        error instanceof AppError &&
        Object.hasOwn(publicErrors, error.code)
      ) {
        const fixed = publicErrors[error.code]!;
        if (error.statusCode === fixed[0])
          throw new AppError(fixed[0], error.code, fixed[1]);
      }
      throw proposalUnavailable();
    } finally {
      resource.dispose();
    }
  }
  return {
    capture: (req: Request, res: Response, input: ProposalCaptureInput) =>
      send(
        req,
        res,
        (authority) => service.capture(input, req.requestId, authority),
        input.technologyId,
        'capture',
      ),
    reconcile: (
      req: Request,
      res: Response,
      operationId: string,
      technologyId: string,
    ) =>
      send(
        req,
        res,
        (authority) =>
          service.reconcile({ operationId, technologyId }, authority),
        technologyId,
        'recovery',
      ),
    get: (req: Request, res: Response, id: string, technologyId: string) =>
      send(
        req,
        res,
        (authority) => service.get(id, technologyId, authority),
        technologyId,
        'detail',
        id,
      ),
  };
}
