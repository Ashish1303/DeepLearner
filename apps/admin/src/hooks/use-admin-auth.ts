import { useEffect, useState, useSyncExternalStore } from 'react';
import { env } from '../lib/env';
import {
  createAdminClient,
  AdminApiError,
  type AdminClient,
} from '../lib/auth/admin-client';
import {
  createAdminController,
  type AdminController,
  type AdminState,
} from '../lib/auth/admin-controller';
import {
  createAdminBrowserCoordination,
  type AdminCoordination,
} from '../lib/auth/browser-coordination';
import { loginInput, type AdminIdentity } from '../lib/auth/contracts';

const unavailable: AdminState = Object.freeze({
  status: 'unavailable',
  user: null,
  pending: false,
  message: 'Admin sign-in is unavailable at this application address.',
});
export function isEligibleAdminState(
  state: AdminState,
): state is AdminState & { user: AdminIdentity } {
  const user = state.user;
  return Boolean(
    state.status === 'eligible' &&
    state.pending === false &&
    user &&
    typeof user === 'object' &&
    !Array.isArray(user) &&
    Object.keys(user).length === 7 &&
    [
      'id',
      'firstName',
      'lastName',
      'email',
      'role',
      'status',
      'emailVerified',
    ].every((key) => Object.hasOwn(user, key)) &&
    typeof user.id === 'string' &&
    /^[a-f0-9]{24}$/.test(user.id) &&
    [user.firstName, user.lastName].every(
      (name) =>
        typeof name === 'string' && name.trim().length > 0 && name.length <= 80,
    ) &&
    typeof user.email === 'string' &&
    loginInput.shape.email.safeParse(user.email).success &&
    user.role === 'ADMIN' &&
    user.status === 'ACTIVE' &&
    user.emailVerified === true,
  );
}
export function createAdminAuthResource(
  base: string,
  fetcher: typeof fetch = fetch,
  coordination: AdminCoordination = createAdminBrowserCoordination(),
) {
  let api: AdminClient;
  let available = true;
  try {
    api = createAdminClient(base, fetcher);
  } catch {
    available = false;
    const refuse = () => Promise.reject(new AdminApiError('REQUEST_FAILED'));
    api = { login: refuse, refresh: refuse, logout: refuse, me: refuse };
  }
  return { controller: createAdminController(api, coordination), available };
}
export interface AdminLifecycleHost {
  document: Pick<
    Document,
    'visibilityState' | 'addEventListener' | 'removeEventListener'
  >;
  window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}
export function attachAdminLifecycle(
  controller: AdminController,
  host: AdminLifecycleHost,
): () => void {
  const disconnect = controller.connect();
  let live = true;
  const visible = () => host.document.visibilityState === 'visible';
  const refuse = () => {
    controller.cancel();
  };
  const check = () => {
    if (!live) return;
    try {
      if (visible()) void controller.revalidate().catch(refuse);
      else controller.suspend();
    } catch {
      refuse();
    }
  };
  const hide = () => {
    if (live) controller.suspend();
  };
  const detach = () => {
    live = false;
    let clean = true;
    for (const remove of [
      () => host.document.removeEventListener('visibilitychange', check),
      () => host.window.removeEventListener('focus', check),
      () => host.window.removeEventListener('pagehide', hide),
    ]) {
      try {
        remove();
      } catch {
        clean = false;
      }
    }
    // Clear authority even if a host cleanup operation itself refuses.
    controller.cancel();
    try {
      disconnect();
    } catch {
      clean = false;
    }
    if (!clean) {
      try {
        controller.dispose();
      } catch {
        /* Authority is already cleared. */
      }
    }
  };
  try {
    host.document.addEventListener('visibilitychange', check);
    host.window.addEventListener('focus', check);
    host.window.addEventListener('pagehide', hide);
    if (!visible()) hide();
  } catch {
    detach();
    try {
      controller.dispose();
    } catch {
      /* No authority is retained. */
    }
    return () => {};
  }
  return () => {
    if (!live) return;
    // Disconnect is reversible for React StrictMode setup/cleanup replay.
    detach();
  };
}

export function useAdminAuth() {
  const [resource] = useState(() =>
    createAdminAuthResource(env.VITE_API_BASE_URL),
  );
  const controller = resource.controller;
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  useEffect(
    () => attachAdminLifecycle(controller, { document, window }),
    [controller],
  );
  return {
    state: resource.available ? state : unavailable,
    controller,
    available: resource.available,
  };
}
