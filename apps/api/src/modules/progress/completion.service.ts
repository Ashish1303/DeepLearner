import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { AccessTokens } from '../auth/access-token.service.js';
import { userRepository } from '../users/user.repository.js';
import type { UserRepository } from '../users/user.repository.js';
import { idempotencyKey } from '../practice/practice.schema.js';
import { createVisualizationCheckpointService } from '../visualizations/visualization-checkpoint.service.js';
import { createSectionEvidenceService } from './section-evidence.service.js';
import {
  completionRepository,
  type CompletionRepository,
} from './completion.repository.js';
import {
  completionId,
  completionDigest,
  completionIssueRequest,
  completionResponseBody,
  completionIssueDto,
  completionResponseDto,
  completionView,
  parseCompletion,
  completionUnavailable,
  completionConflict,
} from './completion.schema.js';

type Subject = { sub: string; role: string };
type Producers = {
  issue(
    section: 'READ' | 'VISUALIZE' | 'EXAMPLE' | 'REVISE',
    token: string,
    concept: string,
    definition: string | undefined,
    key: string,
    correlation: string,
  ): Promise<unknown>;
  respond(
    section: 'READ' | 'VISUALIZE' | 'EXAMPLE' | 'REVISE',
    token: string,
    body: z.output<typeof completionResponseBody>,
    key: string,
    correlation: string,
  ): Promise<unknown>;
};
export function createCompletionService(
  tokens: Pick<AccessTokens, 'verify'>,
  config: { APP_ENV: string },
  repository: CompletionRepository = completionRepository,
  users: Pick<UserRepository, 'get'> = userRepository,
  suppliedProducers?: Producers,
) {
  const acknowledgements = {
    READ: createSectionEvidenceService(tokens, config),
    EXAMPLE: createSectionEvidenceService(
      tokens,
      config,
      undefined,
      undefined,
      'EXAMPLE',
    ),
    REVISE: createSectionEvidenceService(
      tokens,
      config,
      undefined,
      undefined,
      'REVISE',
    ),
  };
  const visual = createVisualizationCheckpointService(tokens, config);
  const producers: Producers = suppliedProducers ?? {
    issue: (section, token, concept, definition, key, correlation) =>
      section === 'VISUALIZE'
        ? visual.issue(
            token,
            { definitionId: definition, idempotencyKey: key },
            correlation,
          )
        : acknowledgements[section].issue(
            token,
            { conceptId: concept, idempotencyKey: key },
            correlation,
          ),
    respond: (section, token, body, key, correlation) =>
      section === 'VISUALIZE'
        ? visual.submit(token, { ...body, idempotencyKey: key }, correlation)
        : acknowledgements[section].acknowledge(
            token,
            { ...body, idempotencyKey: key },
            correlation,
          ),
  };
  async function eligible(subject: Subject) {
    if (config.APP_ENV !== 'LOCAL')
      throw new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found');
    if (
      !completionId.safeParse(subject.sub).success ||
      subject.role !== 'STUDENT'
    )
      throw new AppError(403, 'AUTH_FORBIDDEN', 'Student access required');
    const user = await users.get(subject.sub);
    if (
      user.id !== subject.sub ||
      user.role !== 'STUDENT' ||
      user.status !== 'ACTIVE' ||
      !user.emailVerified
    )
      throw new AppError(
        403,
        'AUTH_FORBIDDEN',
        'Current eligible Student required',
      );
  }
  function validate(concept: string, key?: string) {
    parseCompletion(completionId, concept);
    if (key !== undefined) parseCompletion(idempotencyKey, key);
  }
  async function commandCaller(subject: Subject, token: string) {
    // Ensure the producer's independently verified token identifies the same authenticated owner.
    if (typeof token !== 'string' || token.length > 4096)
      throw new AppError(
        401,
        'AUTH_ACCESS_TOKEN_INVALID',
        'Invalid access token',
      );
    const claim = await tokens.verify(token);
    if (claim.sub !== subject.sub || claim.role !== 'STUDENT')
      throw new AppError(403, 'AUTH_FORBIDDEN', 'Student access required');
  }
  return {
    async get(subject: Subject, concept: string) {
      await eligible(subject);
      validate(concept);
      const view = await repository.read(subject.sub, concept);
      await eligible(subject);
      const parsed = completionView.safeParse(view);
      if (!parsed.success || parsed.data.conceptId !== concept)
        throw completionUnavailable();
      return parsed.data;
    },
    async complete(
      subject: Subject,
      concept: string,
      input: unknown,
      key: string,
    ) {
      await eligible(subject);
      validate(concept, key);
      const body = parseCompletion(
        z.strictObject({ viewRevision: completionDigest }),
        input,
      );
      const view = await repository.complete(
        subject.sub,
        concept,
        body.viewRevision,
        key,
      );
      await eligible(subject);
      const parsed = completionView.safeParse(view);
      if (
        !parsed.success ||
        parsed.data.conceptId !== concept ||
        parsed.data.viewRevision !== body.viewRevision ||
        parsed.data.completion.status !== 'COMPLETED'
      )
        throw completionUnavailable();
      return parsed.data;
    },
    async issue(
      subject: Subject,
      token: string,
      concept: string,
      input: unknown,
      key: string,
      correlation: string,
    ) {
      await eligible(subject);
      validate(concept, key);
      await commandCaller(subject, token);
      const body = parseCompletion(completionIssueRequest.shape.body, input),
        scope = await repository.scope(subject.sub, concept);
      if (
        scope.state !== 'CURRENT' ||
        !scope.policy?.requiredSections.includes(body.section)
      )
        throw completionConflict('COMPLETION_INELIGIBLE');
      const result = await producers.issue(
        body.section,
        token,
        concept,
        scope.policy.checkpointDefinitionId,
        key,
        correlation,
      );
      scope.origin.assert();
      const fresh = await repository.scope(subject.sub, concept);
      await eligible(subject);
      if (fresh.policy?.fingerprint !== scope.policy.fingerprint)
        throw completionConflict('COMPLETION_VIEW_CHANGED');
      const parsed = completionIssueDto.safeParse({
        section: body.section,
        challenge: result,
      });
      if (!parsed.success || parsed.data.challenge.conceptId !== concept)
        throw completionUnavailable();
      return parsed.data;
    },
    async respond(
      subject: Subject,
      token: string,
      concept: string,
      input: unknown,
      key: string,
      correlation: string,
    ) {
      await eligible(subject);
      validate(concept, key);
      await commandCaller(subject, token);
      const body = parseCompletion(completionResponseBody, input),
        scope = await repository.scope(subject.sub, concept);
      if (!scope.policy || scope.state !== 'CURRENT')
        throw completionConflict('COMPLETION_INELIGIBLE');
      const challenge = await repository.challenge(
        subject.sub,
        concept,
        body.challengeId,
      );
      if (
        !scope.policy.requiredSections.includes(challenge.section) ||
        (challenge.section === 'VISUALIZE'
          ? !('selectedChoiceId' in body) ||
            challenge.definitionId !== scope.policy.checkpointDefinitionId
          : !('acknowledged' in body))
      )
        throw completionConflict('COMPLETION_INELIGIBLE');
      const result = await producers.respond(
        challenge.section,
        token,
        body,
        key,
        correlation,
      );
      scope.origin.assert();
      const fresh = await repository.scope(subject.sub, concept);
      await eligible(subject);
      if (fresh.policy?.fingerprint !== scope.policy.fingerprint)
        throw completionConflict('COMPLETION_VIEW_CHANGED');
      const parsed = completionResponseDto.safeParse({
        section: challenge.section,
        receipt: result,
      });
      if (!parsed.success || parsed.data.receipt.conceptId !== concept)
        throw completionUnavailable();
      return parsed.data;
    },
  };
}
export type CompletionService = ReturnType<typeof createCompletionService>;
