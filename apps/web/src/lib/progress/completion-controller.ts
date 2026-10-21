import type { AuthController } from '../auth/auth-controller';
import { ApiError } from '../api/client';
import {
  CompletionError,
  type CompletionClient,
} from '../api/completion-client';
import {
  command,
  completionView,
  completionIssue,
  completionResponse,
  type CompletionView,
  type CompletionIssue,
  type CompletionCommand,
  type EvidenceSection,
} from './completion-contracts';

export type CompletionState = {
  status:
    | 'loading'
    | 'ready'
    | 'saving'
    | 'uncertain'
    | 'error'
    | 'unavailable'
    | 'denied';
  data: CompletionView | null;
  challenge: CompletionIssue | null;
  message: string;
};
export function createCompletionController(
  client: CompletionClient,
  auth: Pick<AuthController, 'runAuthenticatedRead'>,
  account: string,
  concept: string,
  uuid = () => crypto.randomUUID(),
) {
  let state: CompletionState = {
    status: 'loading',
    data: null,
    challenge: null,
    message: '',
  };
  let generation = 0,
    abort: AbortController | undefined,
    pending: CompletionCommand | undefined;
  const listeners = new Set<() => void>();
  const emit = (next: CompletionState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  const busy = () =>
    state.status === 'saving' ||
    state.status === 'loading' ||
    state.status === 'uncertain';
  async function execute(cmd?: CompletionCommand) {
    abort?.abort();
    const request = new AbortController(),
      current = ++generation;
    abort = request;
    emit({
      ...state,
      ...(!cmd ? { data: null, challenge: null } : {}),
      status: cmd ? 'saving' : 'loading',
      message: '',
    });
    try {
      const raw = await auth.runAuthenticatedRead(
        account,
        request.signal,
        (token, signal) =>
          cmd
            ? client.send(concept, token, signal, cmd)
            : client.load(concept, token, signal),
      );
      if (current !== generation || request.signal.aborted) return;
      if (!cmd || cmd.action === 'complete') {
        const data = completionView.parse(raw);
        if (data.conceptId !== concept) throw new ApiError('INVALID_RESPONSE');
        if (
          cmd?.action === 'complete' &&
          data.completion.status !== 'COMPLETED'
        )
          throw new ApiError('INVALID_RESPONSE');
        pending = undefined;
        emit({
          status: 'ready',
          data,
          challenge: null,
          message: cmd ? 'Concept completion saved.' : '',
        });
      } else if (cmd.action === 'challenges') {
        const challenge = completionIssue.parse(raw);
        if (
          challenge.challenge.conceptId !== concept ||
          challenge.section !== cmd.body.section
        )
          throw new ApiError('INVALID_RESPONSE');
        if (
          challenge.section === 'VISUALIZE' &&
          challenge.challenge.visualizationId !== state.data?.visualization?.id
        )
          throw new ApiError('INVALID_RESPONSE');
        pending = undefined;
        emit({
          ...state,
          status: 'ready',
          challenge,
          message: 'Activity is ready for your response.',
        });
      } else {
        const receipt = completionResponse.parse(raw),
          challenge = state.challenge;
        if (
          !challenge ||
          receipt.section !== challenge.section ||
          receipt.receipt.conceptId !== concept
        )
          throw new ApiError('INVALID_RESPONSE');
        if (
          receipt.section === 'VISUALIZE' &&
          challenge.section === 'VISUALIZE' &&
          (receipt.receipt.visualizationId !==
            challenge.challenge.visualizationId ||
            receipt.receipt.checkpointId !== challenge.challenge.checkpointId ||
            receipt.receipt.checkpointVersion !==
              challenge.challenge.checkpointVersion)
        )
          throw new ApiError('INVALID_RESPONSE');
        pending = undefined;
        emit({
          ...state,
          status: 'ready',
          challenge: null,
          message:
            receipt.section === 'VISUALIZE'
              ? receipt.receipt.outcome === 'CORRECT'
                ? 'Correct interaction saved. Refresh requirements to check eligibility.'
                : 'Incorrect interaction saved. Request a new checkpoint if available.'
              : 'Acknowledgement saved. Refresh requirements to check eligibility.',
        });
        // A receipt never certifies completion; refresh the authoritative view.
        await refresh();
      }
    } catch (error) {
      if (current !== generation || request.signal.aborted) return;
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        pending = undefined;
        emit({
          status: error.status === 404 ? 'unavailable' : 'denied',
          data: null,
          challenge: null,
          message: '',
        });
      } else if (
        (error instanceof CompletionError &&
          error.reason !== 'COMPLETION_COMMIT_UNCONFIRMED') ||
        (error instanceof ApiError && [400, 409, 413].includes(error.status))
      ) {
        pending = undefined;
        emit({
          status: 'error',
          data: null,
          challenge: null,
          message:
            'Requirements or request identity changed. Refresh before continuing.',
        });
      } else if (cmd) {
        emit({
          ...state,
          status: 'uncertain',
          message:
            'The request outcome is unconfirmed. Retry sends the identical request; cancellation does not roll it back.',
        });
      } else
        emit({
          status: 'error',
          data: null,
          challenge: null,
          message: 'Completion requirements are temporarily unavailable.',
        });
    }
  }
  async function refresh() {
    if (state.status === 'saving' || pending) return;
    await execute();
  }
  async function send(value: CompletionCommand) {
    if (busy() || pending || !state.data || state.status !== 'ready') return;
    const validated = command.safeParse(value);
    if (!validated.success) return;
    pending = validated.data;
    await execute(pending);
  }
  return {
    load: refresh,
    refresh,
    retry: () =>
      state.status === 'saving' || state.status === 'loading'
        ? Promise.resolve()
        : pending
          ? execute(pending)
          : refresh(),
    issue: (section: EvidenceSection) =>
      state.data?.requiredSections.includes(section)
        ? send({ action: 'challenges', key: uuid(), body: { section } })
        : Promise.resolve(),
    respond: (choice?: string) => {
      const c = state.challenge;
      if (!c) return Promise.resolve();
      return send({
        action: 'responses',
        key: uuid(),
        body:
          c.section === 'VISUALIZE'
            ? { challengeId: c.challenge.id, selectedChoiceId: choice ?? '' }
            : { challengeId: c.challenge.id, acknowledged: true },
      });
    },
    complete: () =>
      state.data?.eligibility === 'ELIGIBLE' &&
      state.data.completion.status !== 'COMPLETED'
        ? send({
            action: 'complete',
            key: uuid(),
            body: { viewRevision: state.data.viewRevision },
          })
        : Promise.resolve(),
    getSnapshot: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    cancel() {
      generation++;
      abort?.abort();
      abort = undefined;
      pending = undefined;
      emit({ status: 'loading', data: null, challenge: null, message: '' });
    },
  };
}
export type CompletionController = ReturnType<
  typeof createCompletionController
>;
