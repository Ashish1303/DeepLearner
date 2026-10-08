import { ApiError, type ApiClient } from '../api/client';
import {
  onboardingProfileSchema,
  type CurrentUser,
  type OnboardingProfile,
} from '../api/contracts';
import { isOnboardingComplete } from '../onboarding/profile';
import { CoordinationError, type Coordination } from './browser-coordination';

export type AuthState = {
  status:
    | 'idle'
    | 'loading'
    | 'authenticated'
    | 'anonymous'
    | 'blocked'
    | 'error'
    | 'unsupported'
    | 'uncertain';
  user: CurrentUser | null;
  message: string;
  pending: boolean;
};
const initial: AuthState = {
  status: 'idle',
  user: null,
  message: '',
  pending: false,
};
const interrupted = Symbol('obsolete operation');
export type ProfileResult =
  | { kind: 'success'; user: CurrentUser }
  | {
      kind: 'error' | 'reverify' | 'uncertain' | 'busy' | 'interrupted';
      message: string;
    };
export function createAuthController(
  api: ApiClient,
  coordination: Coordination,
) {
  let state = initial;
  let token: string | undefined;
  let generation = 0;
  let loggingOut = false;
  let flight: Promise<void> | undefined;
  let profileCheckRequired = false;
  const listeners = new Set<() => void>();
  const update = (next: AuthState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  const valid = (version: number) => {
    if (version !== generation) throw interrupted;
  };
  function failure(error: unknown, version: number) {
    if (version !== generation || error === interrupted) return;
    token = undefined;
    if (error instanceof CoordinationError) {
      update({ ...initial, status: 'unsupported', message: error.message });
    } else if (error instanceof ApiError) {
      const status =
        error.status === 401 || error.code === 'USER_NOT_FOUND'
          ? 'anonymous'
          : [
                'AUTH_ACCOUNT_DISABLED',
                'AUTH_ACCOUNT_SUSPENDED',
                'AUTH_EMAIL_NOT_VERIFIED',
              ].includes(error.code)
            ? 'blocked'
            : 'error';
      update({ ...initial, status, message: error.message });
    } else
      update({
        ...initial,
        status: 'error',
        message: 'The request could not be completed. Please try again.',
      });
  }
  function uncertain(version: number) {
    if (version !== generation) return;
    token = undefined;
    update({
      ...initial,
      status: 'uncertain',
      message:
        'The session request could not be confirmed. Sign in again to continue; it will not be retried automatically.',
    });
    coordination.publish('uncertain');
  }
  async function rotate(version: number) {
    valid(version);
    try {
      const result = await api.refresh();
      valid(version);
      token = result.accessToken;
    } catch (error) {
      if (
        error instanceof ApiError &&
        ['NETWORK_ERROR', 'INVALID_RESPONSE'].includes(error.code)
      ) {
        uncertain(version);
        throw interrupted;
      }
      throw error;
    }
  }
  async function loadUser(
    version: number,
    mayRefresh: boolean,
    publish = true,
  ) {
    valid(version);
    if (!token) throw interrupted;
    let user: CurrentUser;
    try {
      user = await api.me(token);
    } catch (error) {
      valid(version);
      if (!(error instanceof ApiError) || error.status !== 401 || !mayRefresh)
        throw error;
      await rotate(version);
      user = await api.me(token!);
    }
    valid(version);
    if (user.status !== 'ACTIVE' || !user.emailVerified) {
      throw new ApiError(
        user.status === 'DISABLED'
          ? 'AUTH_ACCOUNT_DISABLED'
          : user.status === 'SUSPENDED'
            ? 'AUTH_ACCOUNT_SUSPENDED'
            : 'AUTH_EMAIL_NOT_VERIFIED',
        403,
      );
    }
    if (publish)
      update({ status: 'authenticated', user, message: '', pending: false });
    return user;
  }
  function single(work: () => Promise<void>) {
    if (flight) return flight;
    const current = work().finally(() => {
      if (flight === current) flight = undefined;
    });
    flight = current;
    return current;
  }
  async function profileOperation(
    input?: OnboardingProfile,
  ): Promise<ProfileResult> {
    if (flight || state.pending || loggingOut)
      return {
        kind: 'busy',
        message: 'Wait for the current request to finish.',
      };
    const owner = state.user;
    if (
      state.status !== 'authenticated' ||
      !owner ||
      owner.role !== 'STUDENT' ||
      !token
    )
      return {
        kind: 'error',
        message: 'Sign in with an eligible student account.',
      };
    if (input && profileCheckRequired)
      return {
        kind: 'reverify',
        message:
          'Check your saved profile and session before submitting again.',
      };
    if (input && !onboardingProfileSchema.safeParse(input).success)
      return {
        kind: 'error',
        message: 'Check the onboarding fields before saving.',
      };
    let result: ProfileResult = {
      kind: 'interrupted',
      message: 'The account changed. This result was discarded.',
    };
    await single(async () => {
      const version = generation;
      const previous = state;
      let patchSent = false;
      update({ ...state, pending: true, message: '' });
      try {
        await coordination.run(async () => {
          const current = await loadUser(version, true, false);
          valid(version);
          if (!current || current.id !== owner.id)
            throw new ApiError('AUTH_ACCESS_TOKEN_INVALID', 401);
          if (current.role !== 'STUDENT') {
            update({
              status: 'authenticated',
              user: current,
              pending: false,
              message: '',
            });
            result = {
              kind: 'error',
              message: 'This setup is for student accounts.',
            };
            return;
          }
          let user = current;
          if (input) {
            patchSent = true;
            user = await api.patchProfile(token!, input);
            valid(version);
            if (
              user.id !== owner.id ||
              user.role !== 'STUDENT' ||
              user.status !== 'ACTIVE' ||
              !user.emailVerified ||
              !isOnboardingComplete(user.profile)
            )
              throw new ApiError('INVALID_RESPONSE');
          }
          valid(version);
          profileCheckRequired = false;
          update({
            status: 'authenticated',
            user,
            pending: false,
            message: '',
          });
          result = { kind: 'success', user };
        });
      } catch (error) {
        if (version !== generation || error === interrupted) return;
        const apiError =
          error instanceof ApiError ? error : new ApiError('REQUEST_FAILED');
        const accountFailure = [
          'AUTH_ACCOUNT_DISABLED',
          'AUTH_ACCOUNT_SUSPENDED',
          'AUTH_EMAIL_NOT_VERIFIED',
          'USER_NOT_FOUND',
        ].includes(apiError.code);
        if (
          accountFailure ||
          (!patchSent && apiError.status === 401) ||
          error instanceof CoordinationError
        ) {
          failure(error, version);
          result = { kind: 'error', message: apiError.message };
          return;
        }
        const ambiguous =
          patchSent &&
          ['NETWORK_ERROR', 'INVALID_RESPONSE'].includes(apiError.code);
        const reverify = patchSent && apiError.status === 401;
        profileCheckRequired ||= ambiguous || reverify;
        result = {
          kind: ambiguous ? 'uncertain' : reverify ? 'reverify' : 'error',
          message: ambiguous
            ? 'Saving could not be confirmed. Check the saved profile before retrying; your draft has been kept.'
            : reverify
              ? 'Your session must be checked before you explicitly submit again. Your draft has been kept.'
              : apiError.message,
        };
        update({ ...previous, pending: false });
      }
    });
    return result;
  }
  return {
    saveProfile: (profile: OnboardingProfile) => profileOperation(profile),
    checkProfile: () => profileOperation(),
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    connect() {
      if (!coordination.supported())
        update({
          ...initial,
          status: 'unsupported',
          message: new CoordinationError().message,
        });
      const disconnect = coordination.listen((message) => {
        generation++;
        profileCheckRequired = false;
        token = undefined;
        update({
          ...initial,
          status: message === 'uncertain' ? 'uncertain' : 'anonymous',
          message:
            message === 'identity-changed'
              ? 'The account changed in another tab. Continue by signing in or restoring the session.'
              : message === 'uncertain'
                ? 'A session request in another tab could not be confirmed. Sign in again.'
                : '',
        });
      });
      // Feature detection alone does not prove channel construction is permitted.
      if (!coordination.supported()) {
        generation++;
        token = undefined;
        update({
          ...initial,
          status: 'unsupported',
          message: new CoordinationError().message,
        });
      }
      return disconnect;
    },
    restore(explicit = false) {
      if (
        state.status !== 'idle' &&
        !(explicit && ['error', 'anonymous'].includes(state.status))
      )
        return flight ?? Promise.resolve();
      return single(async () => {
        const version = ++generation;
        update({ ...initial, status: 'loading', pending: true });
        try {
          await coordination.run(async () => {
            await rotate(version);
            await loadUser(version, false);
          });
        } catch (error) {
          failure(error, version);
        }
      });
    },
    login(email: string, password: string) {
      if (flight || state.pending || loggingOut)
        return flight ?? Promise.resolve();
      return single(async () => {
        const version = ++generation;
        token = undefined;
        profileCheckRequired = false;
        update({ ...initial, status: 'loading', pending: true });
        try {
          await coordination.run(async () => {
            valid(version);
            let result;
            try {
              result = await api.login(email, password);
            } catch (error) {
              if (
                error instanceof ApiError &&
                ['NETWORK_ERROR', 'INVALID_RESPONSE'].includes(error.code)
              ) {
                uncertain(version);
                throw interrupted;
              }
              throw error;
            }
            valid(version);
            token = result.accessToken;
            coordination.publish('identity-changed');
            await loadUser(version, true);
          });
        } catch (error) {
          failure(error, version);
        }
      });
    },
    reloadUser() {
      if (state.status !== 'authenticated' || state.pending)
        return flight ?? Promise.resolve();
      return single(async () => {
        const version = generation;
        update({ ...state, pending: true, message: '' });
        try {
          await coordination.run(() => loadUser(version, true));
        } catch (error) {
          failure(error, version);
        }
      });
    },
    async logout() {
      if (loggingOut) return;
      loggingOut = true;
      // Invalidate outstanding reads now; let an already-sent rotation settle before logout.
      const version = ++generation;
      const previous: AuthState = {
        ...state,
        status: state.status === 'loading' ? 'error' : state.status,
        pending: false,
      };
      update({ ...state, pending: true, message: '' });
      try {
        if (flight) await flight;
        await coordination.run(async () => {
          valid(version);
          await api.logout();
          valid(version);
          token = undefined;
          update({ ...initial, status: 'anonymous' });
          coordination.publish('signed-out');
        });
      } catch (error) {
        if (version !== generation || error === interrupted) return;
        update({
          ...previous,
          message: 'Sign-out was not confirmed. Please try again.',
          pending: false,
        });
      } finally {
        loggingOut = false;
      }
    },
  };
}
export type AuthController = ReturnType<typeof createAuthController>;
