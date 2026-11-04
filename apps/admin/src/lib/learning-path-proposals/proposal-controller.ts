import type { AdminController } from '../auth/admin-controller';
import { technologyDto, type Technology } from '../technologies/contracts';
import {
  contentSchema,
  draftSchema,
  emptyDraft,
  matchesIntent,
  proposalDto,
  recoveryDto,
  type Proposal,
  type ProposalDraft,
} from './contracts';
import { ProposalError } from './proposal-client';

export type ProposalState = Readonly<{
  status:
    | 'idle'
    | 'editing'
    | 'saving'
    | 'saved'
    | 'refused'
    | 'uncertain'
    | 'reconciling'
    | 'resolved'
    | 'unresolved'
    | 'loading-detail'
    | 'read-error'
    | 'denied'
    | 'context-lost';
  open: boolean;
  parent: Technology | null;
  draft: ProposalDraft;
  dirty: boolean;
  result: Proposal | null;
  message: string;
  errors: Readonly<Record<string, string>>;
}>;
const initial = (): ProposalState =>
  Object.freeze({
    status: 'idle',
    open: false,
    parent: null,
    draft: emptyDraft(),
    dirty: false,
    result: null,
    message: '',
    errors: {},
  });
type Auth = Pick<
  AdminController,
  | 'subscribe'
  | 'getSnapshot'
  | 'getProposalIntent'
  | 'requestProposal'
  | 'hasTechnologyUncertainty'
>;
export function createProposalController(auth: Auth, accountId: string) {
  const serverInitial = initial();
  let state = initial(),
    connected = false,
    disposed = false,
    generation = 0,
    submitting = false;
  let stop: (() => void) | undefined, read: AbortController | undefined;
  let blockedParent = false,
    pendingParent: Technology | null = null;
  const listeners = new Set<() => void>();
  const update = (next: ProposalState) => {
    state = Object.freeze(next);
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        /* Subscriber is isolated. */
      }
    }
  };
  const eligible = () => {
    const s = auth.getSnapshot();
    return (
      connected &&
      !disposed &&
      s.status === 'eligible' &&
      !s.pending &&
      s.user?.id === accountId &&
      s.user.role === 'ADMIN' &&
      s.user.status === 'ACTIVE' &&
      s.user.emailVerified
    );
  };
  const busy = () => ['saving', 'reconciling'].includes(state.status);
  function sync() {
    if (!eligible()) {
      blockedParent = false;
      pendingParent = null;
      generation++;
      read?.abort();
      update({ ...initial(), status: 'denied' });
      return;
    }
    const intent = auth.getProposalIntent(accountId);
    if (intent.phase === 'context-lost') {
      generation++;
      read?.abort();
      update({
        ...initial(),
        parent: state.parent,
        status: 'context-lost',
        message: new ProposalError('CONTEXT_LOST').message,
      });
    } else if (intent.phase !== 'none') {
      const same = state.parent?.id === intent.technologyId;
      update({
        ...state,
        status: intent.phase,
        draft: same ? structuredClone(intent.content) : emptyDraft(),
        dirty: false,
        result: null,
        errors: {},
        message: same
          ? 'A Save is unconfirmed. Only an explicit outcome check can resolve it; never repeat the Save.'
          : 'A Save in another selection is unconfirmed. Return to its Technology to check the outcome. No new Save is available.',
      });
    }
  }
  function parent(value: Technology | null) {
    const parsed = technologyDto.safeParse(value),
      next = parsed.success ? parsed.data : null;
    if (
      state.dirty &&
      (state.parent?.id !== next?.id || next?.status === 'ARCHIVED')
    ) {
      generation++;
      read?.abort();
      blockedParent = true;
      pendingParent = next;
      update({
        ...state,
        status: 'refused',
        message:
          'The selected Technology is unavailable, changed or archived. Save is disabled. Explicitly discard the retained draft before proceeding.',
      });
      return;
    }
    if (state.parent?.id === next?.id) {
      if (next && state.parent !== value) update({ ...state, parent: next });
      sync();
      return;
    }
    generation++;
    read?.abort();
    update({ ...initial(), parent: next });
    sync();
  }
  const canEdit = () =>
    eligible() &&
    !blockedParent &&
    !auth.hasTechnologyUncertainty() &&
    state.open &&
    !busy() &&
    !state.result &&
    ['editing', 'refused'].includes(state.status) &&
    state.parent !== null &&
    state.parent.status !== 'ARCHIVED' &&
    auth.getProposalIntent(accountId).phase === 'none';
  async function save() {
    if (submitting || !canEdit()) return;
    const parsed = contentSchema.safeParse(state.draft);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (Object.keys(errors).length < 64)
          errors[path] =
            'Enter a valid, trimmed single-line value within the stated bounds; entries must be distinct.';
      }
      update({
        ...state,
        errors,
        message: 'Check the highlighted brief fields.',
      });
      return;
    }
    const technologyId = state.parent!.id,
      version = ++generation;
    const content = parsed.data;
    submitting = true;
    update({
      ...state,
      status: 'saving',
      errors: {},
      message: 'Saving private proposal…',
    });
    try {
      const value = await auth.requestProposal(accountId, {
        kind: 'capture',
        technologyId,
        input: content,
      });
      if (
        version !== generation ||
        !eligible() ||
        state.parent?.id !== technologyId
      )
        return;
      if (!matchesIntent(value, technologyId, content))
        throw new ProposalError('INVALID_RESPONSE');
      update({
        ...state,
        status: 'saved',
        result: proposalDto.parse(value),
        draft: emptyDraft(),
        dirty: false,
        message: 'Private proposal saved — not approved or published.',
      });
    } catch (error) {
      if (version !== generation || !eligible()) return;
      sync();
      if (auth.getProposalIntent(accountId).phase === 'none')
        update({
          ...state,
          status: 'refused',
          dirty: true,
          message:
            error instanceof ProposalError
              ? error.message
              : new ProposalError('UNAVAILABLE').message,
        });
    } finally {
      submitting = false;
    }
  }
  async function recover() {
    if (submitting || !eligible() || busy()) return;
    const intent = auth.getProposalIntent(accountId);
    if (
      intent.phase === 'none' ||
      intent.phase === 'context-lost' ||
      intent.technologyId !== state.parent?.id
    )
      return;
    const version = ++generation,
      technologyId = intent.technologyId;
    submitting = true;
    update({
      ...state,
      status: 'reconciling',
      message: 'Checking the existing save outcome…',
    });
    try {
      const raw = await auth.requestProposal(accountId, { kind: 'recover' });
      if (
        version !== generation ||
        !eligible() ||
        state.parent?.id !== technologyId
      )
        return;
      const value = recoveryDto.safeParse(raw);
      if (
        !value.success ||
        (value.data.state === 'COMMITTED' &&
          !matchesIntent(value.data.proposal, technologyId, intent.content))
      )
        throw new ProposalError('INVALID_RESPONSE');
      if (value.data.state === 'COMMITTED')
        update({
          ...state,
          status: 'resolved',
          result: value.data.proposal,
          draft: emptyDraft(),
          dirty: false,
          message: 'Existing private proposal resolved — no Save was replayed.',
        });
      else
        update({
          ...state,
          status: 'unresolved',
          message:
            'UNRESOLVED does not mean absent. Do not repeat Save. An explicit read check or separately approved operator reconciliation is required.',
        });
    } catch (error) {
      if (version !== generation || !eligible()) return;
      sync();
      update({
        ...state,
        status: state.status === 'context-lost' ? 'context-lost' : 'unresolved',
        message:
          error instanceof ProposalError
            ? error.message
            : new ProposalError('UNAVAILABLE').message,
      });
    } finally {
      submitting = false;
    }
  }
  async function detail() {
    if (submitting || !eligible() || !state.result || busy()) return;
    const retained = state.result,
      version = ++generation;
    read?.abort();
    const abort = new AbortController();
    read = abort;
    update({
      ...state,
      status: 'loading-detail',
      result: null,
      message: 'Loading private proposal…',
    });
    try {
      const raw = await auth.requestProposal(
        accountId,
        {
          kind: 'detail',
          id: retained.id,
          technologyId: retained.technologyId,
        },
        abort.signal,
      );
      if (
        version !== generation ||
        abort.signal.aborted ||
        !eligible() ||
        state.parent?.id !== retained.technologyId
      )
        return;
      const value = proposalDto.safeParse(raw);
      if (
        !value.success ||
        value.data.id !== retained.id ||
        value.data.technologyId !== retained.technologyId
      )
        throw new ProposalError('INVALID_RESPONSE');
      update({
        ...state,
        status: 'saved',
        result: value.data,
        message: 'Private result refreshed.',
      });
    } catch (error) {
      if (version !== generation || !eligible()) return;
      // Keep only a validated known result for explicit retry, never a mutation replay.
      update({
        ...state,
        status: 'read-error',
        result: retained,
        message:
          error instanceof ProposalError
            ? error.message
            : new ProposalError('UNAVAILABLE').message,
      });
    }
  }
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => serverInitial,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    connect() {
      if (connected || disposed) return () => {};
      connected = true;
      stop = auth.subscribe(sync);
      sync();
      return () => {
        connected = false;
        stop?.();
        stop = undefined;
        generation++;
        read?.abort();
        update(initial());
      };
    },
    setParent: parent,
    canEdit,
    isBusy: busy,
    open() {
      if (
        !eligible() ||
        blockedParent ||
        auth.hasTechnologyUncertainty() ||
        !state.parent ||
        state.parent.status === 'ARCHIVED'
      )
        return;
      sync();
      if (auth.getProposalIntent(accountId).phase !== 'none') {
        update({ ...state, open: true });
        return;
      }
      update({
        ...initial(),
        parent: state.parent,
        open: true,
        status: 'editing',
      });
    },
    edit(raw: unknown) {
      if (!canEdit()) return;
      const value = draftSchema.safeParse(raw);
      if (value.success)
        update({
          ...state,
          draft: value.data,
          dirty: true,
          errors: {},
          message: '',
        });
    },
    leave() {
      if (busy()) return false;
      generation++;
      read?.abort();
      const next = blockedParent ? pendingParent : state.parent;
      blockedParent = false;
      pendingParent = null;
      update({ ...initial(), parent: next });
      sync();
      return true;
    },
    save,
    recover,
    detail,
    needsWarning: () =>
      state.dirty ||
      busy() ||
      !['none'].includes(auth.getProposalIntent(accountId).phase),
    dispose() {
      disposed = true;
      connected = false;
      generation++;
      stop?.();
      read?.abort();
      update(initial());
      listeners.clear();
    },
  };
}
export type ProposalController = ReturnType<typeof createProposalController>;
