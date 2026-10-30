import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, type TestContext } from 'node:test';
import { createElement, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as clients from '../src/lib/auth/admin-client';
import * as controllers from '../src/lib/auth/admin-controller';
import * as coordinationModule from '../src/lib/auth/browser-coordination';
import * as contracts from '../src/lib/auth/contracts';
import type { AdminClient } from '../src/lib/auth/admin-client';
import type {
  AdminController,
  AdminState,
} from '../src/lib/auth/admin-controller';
import type {
  AdminControl,
  AdminCoordination,
} from '../src/lib/auth/browser-coordination';

// Existing React server rendering plus inert host/form doubles: no network or browser.
const require = createRequire(import.meta.url);
const user: contracts.CurrentUser = {
  id: 'a'.repeat(24),
  firstName: 'Fixture',
  lastName: 'Admin',
  email: 'admin@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  emailVerified: true,
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: '2026-10-29T00:00:00.000Z',
};
const identity = contracts.projectAdmin(user)!;
const initial: AdminState = {
  status: 'idle',
  user: null,
  pending: false,
  message: '',
};
const eligible: AdminState = { ...initial, status: 'eligible', user: identity };
const access = {
  accessToken: 'synthetic-access',
  expiresInSeconds: 900 as const,
};
const login = {
  ...access,
  user: {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    plan: user.plan,
    status: 'ACTIVE' as const,
  },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function compile(
  file: string,
  load: (name: string) => unknown,
  document: unknown = { visibilityState: 'visible' },
  window: unknown = {},
) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const out: Record<string, unknown> = {};
  new Function('require', 'exports', 'document', 'window', js)(
    load,
    out,
    document,
    window,
  );
  return out;
}
interface LifecycleHost {
  document: Pick<
    Document,
    'visibilityState' | 'addEventListener' | 'removeEventListener'
  >;
  window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}
interface HookExports {
  isEligibleAdminState(state: AdminState): boolean;
  createAdminAuthResource(
    base: string,
    fetcher: typeof fetch,
    coordination: AdminCoordination,
  ): { controller: AdminController; available: boolean };
  attachAdminLifecycle(
    controller: AdminController,
    host: LifecycleHost,
  ): () => void;
  useAdminAuth(): {
    controller: AdminController;
    available: boolean;
    state: AdminState;
  };
}
function hook(
  react: unknown = require('react'),
  host?: LifecycleHost,
  base = 'http://localhost:4000/api/v1',
) {
  return compile(
    '../src/hooks/use-admin-auth.ts',
    (name) => {
      if (name === 'react') return react;
      if (name === '../lib/env') return { env: { VITE_API_BASE_URL: base } };
      if (name === '../lib/auth/admin-client') return clients;
      if (name === '../lib/auth/admin-controller') return controllers;
      if (name === '../lib/auth/browser-coordination')
        return coordinationModule;
      if (name === '../lib/auth/contracts') return contracts;
      throw Error('Unexpected hook import');
    },
    host?.document,
    host?.window,
  ) as unknown as HookExports;
}
const helpers = hook();
type ViewProps = {
  state: AdminState;
  controller: AdminController;
  available?: boolean;
};
function view(
  react: unknown = require('react'),
  document: unknown = { visibilityState: 'visible' },
) {
  return compile(
    '../src/components/auth/admin-access.tsx',
    (name) => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '../../hooks/use-admin-auth') return helpers;
      throw Error('Unexpected access import');
    },
    document,
  ).AdminAccess as (props: ViewProps) => ReactElement;
}
const blankController = {} as AdminController;
const render = (state = initial, available = true) =>
  renderToStaticMarkup(
    createElement(view(), { state, controller: blankController, available }),
  );
function app(
  state: AdminState,
  available = true,
  controller = blankController,
) {
  const Access = view();
  const shell = compile('../src/components/layout/admin-shell.tsx', (name) => {
    assert.equal(name, 'react/jsx-runtime');
    return require(name);
  });
  const App = compile('../src/app/app.tsx', (name) => {
    if (name === 'react/jsx-runtime') return require(name);
    if (name === '../components/layout/admin-shell') return shell;
    if (name === '../components/auth/admin-access')
      return { AdminAccess: Access };
    if (name === '../hooks/use-admin-auth')
      return {
        ...helpers,
        useAdminAuth: () => ({ state, available, controller }),
      };
    throw Error('Unexpected App import');
  }).App as () => ReactElement;
  return { App, html: () => renderToStaticMarkup(createElement(App)) };
}
function fixture(
  t: TestContext,
  overrides: Partial<AdminClient> = {},
  supported = true,
) {
  const calls: string[] = [];
  let receive: ((message: AdminControl) => void) | undefined;
  let listeners = 0;
  const coordination: AdminCoordination = {
    supported: () => supported,
    async run(work, signal) {
      signal?.throwIfAborted();
      return work();
    },
    publish() {},
    listen(fn) {
      listeners++;
      receive = fn;
      return () => {
        listeners--;
        receive = undefined;
      };
    },
  };
  const api: AdminClient = {
    login: async () => {
      calls.push('login');
      return login;
    },
    refresh: async () => {
      calls.push('refresh');
      return access;
    },
    me: async () => {
      calls.push('me');
      return user;
    },
    logout: async () => {
      calls.push('logout');
      return null;
    },
    ...overrides,
  };
  const controller = controllers.createAdminController(api, coordination);
  t.after(() => controller.dispose());
  return {
    controller,
    coordination,
    calls,
    emit: (message: AdminControl) => receive?.(message),
    listeners: () => listeners,
  };
}
function host() {
  const events = new Map<string, Set<EventListenerOrEventListenerObject>>();
  let visibility: DocumentVisibilityState = 'visible';
  const add = (type: string, fn: EventListenerOrEventListenerObject | null) => {
    if (!fn) return;
    const set = events.get(type) ?? new Set();
    set.add(fn);
    events.set(type, set);
  };
  const remove = (
    type: string,
    fn: EventListenerOrEventListenerObject | null,
  ) => {
    if (fn) events.get(type)?.delete(fn);
  };
  const document = {
    get visibilityState() {
      return visibility;
    },
    addEventListener: add,
    removeEventListener: remove,
  };
  const window = { addEventListener: add, removeEventListener: remove };
  return {
    document,
    window,
    visibility(value: DocumentVisibilityState) {
      visibility = value;
    },
    count: () => [...events.values()].reduce((sum, set) => sum + set.size, 0),
    fire(type: string) {
      for (const fn of events.get(type) ?? []) {
        const event = { type } as Event;
        if (typeof fn === 'function') fn(event);
        else fn.handleEvent(event);
      }
    },
  };
}

test('only a complete current active verified Admin projection exposes the scaffold', () => {
  assert(helpers.isEligibleAdminState(eligible));
  const html = app(eligible).html();
  for (const text of [
    'Welcome, Fixture.',
    user.email,
    'Sign out of this device',
    'Skip to content',
    'Administration',
    'main-content',
  ])
    assert(html.includes(text));
  assert(!html.includes('Admin sign in'));
});
for (const status of [
  'idle',
  'checking',
  'anonymous',
  'denied',
  'expired',
  'unavailable',
  'rate-limited',
  'error',
  'unsupported',
  'uncertain',
] as const)
  test(
    status + ' hides privileged identity and actions even with a stale user',
    () => {
      const html = app({
        ...eligible,
        status,
        pending: status === 'checking',
      }).html();
      assert(!html.includes('Welcome, Fixture.'));
      assert(!html.includes(user.email));
      assert(!html.includes('Sign out of this device'));
      assert(html.includes('Admin sign in'));
    },
  );
const invalidStates = [
  { ...eligible, pending: true },
  { ...eligible, user: null },
  ...[
    { role: 'STUDENT' },
    { status: 'DISABLED' },
    { status: 'SUSPENDED' },
    { emailVerified: false },
    { id: 'javascript:bad' },
    { email: 'invalid' },
    { firstName: '' },
    { firstName: 'x'.repeat(81) },
    { accessToken: 'PRIVATE_TOKEN' },
  ].map((patch) => ({ ...eligible, user: { ...identity, ...patch } })),
] as AdminState[];
test('view boundary refuses malformed, private or contradictory eligible projections', () => {
  for (const state of invalidStates) {
    assert(!helpers.isEligibleAdminState(state));
    const html = app(state).html();
    assert(!html.includes('Welcome,'));
    assert(!html.includes(user.email));
    assert(!html.includes('PRIVATE_TOKEN'));
    assert(!html.includes('eligibility has been checked'));
    assert(html.includes('could not be confirmed'));
  }
});
test('invalid application configuration cannot expose even a valid stale identity', () => {
  const html = app(eligible, false).html();
  assert(!html.includes('Welcome,'));
  assert(html.includes('temporarily unavailable'));
  assert(html.includes('<fieldset disabled=""'));
});
test('untrusted identity text is escaped and cannot create markup or navigation', () => {
  const state = {
    ...eligible,
    user: { ...identity, firstName: '<img src=x onerror=alert(1)>' },
  };
  const html = app(state).html();
  assert(html.includes('&lt;img'));
  assert(!html.includes('<img'));
  assert(!html.includes('javascript:'));
});
test('fixed messages never render raw errors, credentials or private server fields', () => {
  for (const status of [
    'error',
    'unavailable',
    'rate-limited',
    'denied',
    'uncertain',
  ] as const) {
    const html = render({
      ...initial,
      status,
      message: 'PRIVATE_TOKEN private database error',
    });
    assert(!html.includes('PRIVATE_TOKEN'));
    assert(!html.includes('database error'));
    assert(html.includes('role="alert"'));
    assert(html.includes('aria-live="assertive"'));
  }
  assert(
    render({
      ...initial,
      status: 'error',
      message: 'Invalid email or password.',
    }).includes('Invalid email or password.'),
  );
});
test('native labelled form and explicit recovery controls preserve semantics', () => {
  const html = render();
  for (const text of [
    'for="admin-email"',
    'for="admin-password"',
    'type="email"',
    'type="password"',
    'autoComplete="username"',
    'autoComplete="current-password"',
    'minLength="10"',
    'maxLength="128"',
    'aria-describedby="admin-access-status admin-session-note"',
    'Restore existing session',
    'separate Student and Admin',
    'aria-atomic="true"',
  ])
    assert(html.includes(text), text);
  assert(!/Remember me|Google|Create account|href="http/.test(html));
  assert(!html.includes('value="synthetic'));
});
test('pending and unsupported access disables credential submission without removing cancellation', () => {
  const pending = render({ ...initial, status: 'checking', pending: true });
  assert(pending.includes('<fieldset disabled=""'));
  assert(pending.includes('Cancel access check'));
  assert(pending.includes('aria-busy="true"'));
  assert(
    render({ ...initial, status: 'unsupported' }).includes(
      '<fieldset disabled=""',
    ),
  );
});
test('uncertain mutation disables restoration and exposes explicit sign-out recovery', () => {
  const html = render({ ...initial, status: 'uncertain' });
  assert(/disabled=""[^>]*>Restore existing session/.test(html));
  assert(html.includes('Retry sign-out of this device'));
  assert(!html.includes('Retry session check'));
});
test('scaffold contains no unsupported metrics, management links or account claims', () => {
  const html = app(eligible).html();
  assert(html.includes('not available in this scaffold'));
  assert(
    !/Total Users|System Status|Live production|Revenue|href="\/admin/.test(
      html,
    ),
  );
  const links = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
  assert.deepEqual(links, ['#main-content']);
});

function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function inertView(
  controller: AdminController,
  state = initial,
  form?: unknown,
) {
  const refs: { current: unknown }[] = [],
    states: unknown[] = [],
    effects: (() => void | (() => void))[] = [];
  let refIndex = 0,
    stateIndex = 0,
    focused = 0;
  const visibility = { visibilityState: 'visible' };
  const react = {
    useRef(value: unknown) {
      const index = refIndex++;
      return refs[index] ?? (refs[index] = { current: value });
    },
    useState(value: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = value;
      return [
        states[index],
        (next: unknown) => {
          states[index] = next;
        },
      ];
    },
    useEffect(fn: () => void | (() => void)) {
      effects.push(fn);
    },
  };
  const Component = view(react, visibility);
  const draw = (next = state) => {
    refIndex = 0;
    stateIndex = 0;
    return Component({ state: next, controller });
  };
  const tree = draw();
  if (form) refs[1]!.current = form;
  refs[0]!.current = {
    focus() {
      focused++;
    },
  };
  const cleanups = effects
    .splice(0)
    .map((fn) => fn())
    .filter((fn): fn is () => void => typeof fn === 'function');
  return {
    tree,
    draw,
    refs,
    states,
    visibility,
    focused: () => focused,
    effects: () => {
      effects.splice(0).forEach((fn) => fn());
    },
    cleanup: () => cleanups.forEach((fn) => fn()),
  };
}
function button(tree: ReactElement, name: string) {
  const element = elements(tree).find(
    (item) => item.type === 'button' && item.props.children === name,
  );
  assert(element, name);
  return element;
}
const click = (tree: ReactElement, name: string) =>
  (button(tree, name).props.onClick as () => void)();
test('submit clears the password field immediately and suppresses duplicate in-flight input', async () => {
  const pending = deferred<void>();
  let count = 0,
    cancelled = 0;
  const controller = {
    login: async (email: string, password: string) => {
      count++;
      assert.equal(email, user.email);
      assert.equal(password, 'synthetic-only-password');
      await pending.promise;
    },
    cancel() {
      cancelled++;
    },
  } as unknown as AdminController;
  const email = { tagName: 'INPUT', value: user.email },
    password = { tagName: 'INPUT', value: 'synthetic-only-password' };
  const form = {
    elements: {
      namedItem: (name: string) => (name === 'email' ? email : password),
    },
  };
  const f = inertView(controller, initial, form);
  const submit = elements(f.tree).find((item) => item.type === 'form')!.props
    .onSubmit as (event: unknown) => Promise<void>;
  let prevented = 0;
  const event = {
    preventDefault() {
      prevented++;
    },
    currentTarget: form,
  };
  const first = submit(event);
  assert.equal(password.value, '');
  assert.equal(count, 1);
  password.value = 'second-synthetic-input';
  await submit(event);
  assert.equal(count, 1);
  assert.equal(password.value, '');
  assert(f.states.every((value) => typeof value === 'boolean'));
  pending.resolve();
  await first;
  assert.equal(cancelled, 0);
  assert.equal(prevented, 2);
  f.draw();
  f.effects();
  assert.equal(f.focused(), 1);
  password.value = 'discard-on-unmount';
  f.cleanup();
  assert.equal(password.value, '');
});
test('underlying rejected action fails closed without unhandled errors or retained password', async () => {
  let cancelled = 0;
  const f = inertView({
    login: async () => {
      throw Error('PRIVATE_REJECTION');
    },
    cancel() {
      cancelled++;
    },
  } as unknown as AdminController);
  const field = { tagName: 'INPUT', value: 'synthetic-only-password' };
  const form = {
    elements: {
      namedItem: (name: string) =>
        name === 'email' ? { tagName: 'INPUT', value: user.email } : field,
    },
  };
  f.refs[1]!.current = form;
  const submit = elements(f.tree).find((item) => item.type === 'form')!.props
    .onSubmit as (event: unknown) => Promise<void>;
  await submit({ preventDefault() {}, currentTarget: form });
  assert.equal(field.value, '');
  assert.equal(cancelled, 1);
  f.cleanup();
});
test('explicit restore, retry, sign-out recovery and cancel call only their existing controller actions', async () => {
  const calls: string[] = [];
  const controller = {
    restore: async () => {
      calls.push('restore');
    },
    logout: async () => {
      calls.push('logout');
    },
    cancel: () => {
      calls.push('cancel');
    },
  } as unknown as AdminController;
  const f = inertView(controller);
  assert.deepEqual(calls, []);
  click(f.tree, 'Restore existing session');
  await flush();
  click(f.draw({ ...initial, status: 'unavailable' }), 'Retry session check');
  await flush();
  click(
    f.draw({ ...initial, status: 'uncertain' }),
    'Retry sign-out of this device',
  );
  await flush();
  click(
    f.draw({ ...initial, status: 'checking', pending: true }),
    'Cancel access check',
  );
  assert.deepEqual(calls, ['restore', 'restore', 'logout', 'cancel']);
  f.cleanup();
});
test('access revalidation and shell logout are wired without redirects or extra API actions', async () => {
  let revalidations = 0,
    logouts = 0;
  const controller = {
    revalidate: async () => {
      revalidations++;
    },
    logout: async () => {
      logouts++;
    },
  } as unknown as AdminController;
  const f = inertView(controller, eligible);
  click(f.tree, 'Check current access');
  await flush();
  assert.equal(revalidations, 1);
  const root = app(eligible, true, controller).App();
  const session = (root.props as { session: { onLogout(): void } }).session;
  session.onLogout();
  await flush();
  assert.equal(logouts, 1);
  f.cleanup();
});
test('focus effect restores heading after loss of access only while visible', () => {
  const f = inertView(blankController, eligible);
  assert.equal(f.focused(), 0);
  f.visibility.visibilityState = 'hidden';
  f.draw({ ...initial, status: 'denied' });
  f.effects();
  assert.equal(f.focused(), 0);
  f.visibility.visibilityState = 'visible';
  f.draw({ ...initial, status: 'denied' });
  f.effects();
  assert.equal(f.focused(), 1);
  f.cleanup();
});

test('mount is passive; visibility and focus revalidate existing authority without refresh rotation', async (t) => {
  const f = fixture(t),
    h = host();
  const detach = helpers.attachAdminLifecycle(f.controller, h);
  assert.deepEqual(f.calls, []);
  assert.equal(h.count(), 3);
  await f.controller.restore();
  assert.deepEqual(f.calls, ['refresh', 'me']);
  h.visibility('hidden');
  h.fire('visibilitychange');
  assert.equal(f.controller.getSnapshot().user, null);
  h.visibility('visible');
  h.fire('visibilitychange');
  await flush();
  assert.equal(f.controller.getSnapshot().status, 'eligible');
  h.fire('focus');
  await flush();
  assert.deepEqual(f.calls, ['refresh', 'me', 'me', 'me']);
  detach();
  assert.equal(h.count(), 0);
  assert.equal(f.listeners(), 0);
  assert.equal(f.controller.getSnapshot().user, null);
});
test('pagehide removes displayed authority and returning requires a fresh GET', async (t) => {
  const f = fixture(t),
    h = host(),
    detach = helpers.attachAdminLifecycle(f.controller, h);
  await f.controller.restore();
  h.fire('pagehide');
  assert.equal(f.controller.getSnapshot().user, null);
  h.fire('focus');
  await flush();
  assert.equal(f.controller.getSnapshot().status, 'eligible');
  assert.deepEqual(f.calls, ['refresh', 'me', 'me']);
  detach();
});
test('StrictMode setup/cleanup replay reconnects one listener and does not restore automatically', async (t) => {
  const f = fixture(t),
    h = host();
  const first = helpers.attachAdminLifecycle(f.controller, h);
  first();
  first();
  const second = helpers.attachAdminLifecycle(f.controller, h);
  assert.equal(h.count(), 3);
  assert.equal(f.listeners(), 1);
  assert.deepEqual(f.calls, []);
  await f.controller.restore();
  assert.equal(f.controller.getSnapshot().status, 'eligible');
  second();
  assert.equal(h.count(), 0);
  assert.equal(f.listeners(), 0);
});
test('unmount aborts eligibility reads and discards late account data', async (t) => {
  const response = deferred<contracts.CurrentUser>();
  let signal: AbortSignal | undefined;
  const f = fixture(t, {
      me: async (_token, incoming) => {
        signal = incoming;
        return response.promise;
      },
    }),
    h = host();
  const detach = helpers.attachAdminLifecycle(f.controller, h),
    pending = f.controller.restore();
  await flush();
  detach();
  assert(signal?.aborted);
  response.resolve(user);
  await pending;
  assert.equal(f.controller.getSnapshot().user, null);
  assert.equal(h.count(), 0);
});
for (const control of ['identity-changed', 'signed-out', 'uncertain'] as const)
  test(
    'account coordination immediately hides identity on ' + control,
    async (t) => {
      const f = fixture(t),
        h = host(),
        detach = helpers.attachAdminLifecycle(f.controller, h);
      await f.controller.restore();
      f.emit(control);
      assert.equal(f.controller.getSnapshot().user, null);
      h.fire('focus');
      await flush();
      assert.deepEqual(f.calls, ['refresh', 'me']);
      detach();
    },
  );
test('unsupported coordination fails closed before credential or cookie calls', async (t) => {
  const f = fixture(t, {}, false),
    h = host(),
    detach = helpers.attachAdminLifecycle(f.controller, h);
  await f.controller.login(user.email, 'synthetic-only-password');
  assert.deepEqual(f.calls, []);
  assert.equal(f.controller.getSnapshot().status, 'unsupported');
  detach();
});
test('event subscription failure clears authority and leaves no attached listeners', async (t) => {
  const f = fixture(t),
    h = host();
  f.controller.connect();
  await f.controller.restore();
  const bad = {
    document: h.document,
    window: {
      ...h.window,
      addEventListener() {
        throw Error('PRIVATE_HOST_FAILURE');
      },
    },
  };
  const detach = helpers.attachAdminLifecycle(f.controller, bad);
  detach();
  assert.equal(f.controller.getSnapshot().user, null);
  assert.equal(h.count(), 0);
  assert(!f.controller.getSnapshot().message.includes('PRIVATE_HOST_FAILURE'));
});
test('resource configuration refusal is sanitized and never sends an HTTP request', async (t) => {
  const f = fixture(t);
  let sends = 0;
  const resource = helpers.createAdminAuthResource(
    'javascript:private',
    async () => {
      sends++;
      throw Error('no send');
    },
    f.coordination,
  );
  t.after(() => resource.controller.dispose());
  resource.controller.connect();
  await resource.controller.restore();
  assert.equal(resource.available, false);
  assert.equal(sends, 0);
  assert.equal(resource.controller.getSnapshot().user, null);
});
test('actual hook creates one passive resource, subscribes snapshots and attaches reversible effect', () => {
  let resource: unknown, effect: (() => () => void) | undefined;
  const h = host();
  const out = hook(
    {
      useState(init: () => unknown) {
        resource ??= init();
        return [resource];
      },
      useSyncExternalStore(_subscribe: unknown, snapshot: () => AdminState) {
        return snapshot();
      },
      useEffect(fn: () => () => void) {
        effect = fn;
      },
    },
    h,
  );
  const first = out.useAdminAuth();
  assert.equal(first.state.status, 'idle');
  assert.equal(first.controller, out.useAdminAuth().controller);
  assert.equal(h.count(), 0);
  const detach = effect!();
  assert.equal(h.count(), 3);
  assert.equal(first.controller.getSnapshot().user, null);
  detach();
  assert.equal(h.count(), 0);
  first.controller.dispose();
});
test('source preserves memory-only state, lifecycle cancellation and static accessibility styling', () => {
  const sources = [
    '../src/hooks/use-admin-auth.ts',
    '../src/components/auth/admin-access.tsx',
    '../src/app/app.tsx',
    '../src/components/layout/admin-shell.tsx',
  ]
    .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
    .join('\n');
  assert(
    !/localStorage|sessionStorage|document\.cookie|dangerouslySetInnerHTML|window\.location|console\.(log|error)|setInterval/.test(
      sources,
    ),
  );
  const css = readFileSync(
    new URL('../src/styles/globals.css', import.meta.url),
    'utf8',
  );
  for (const token of [
    ':focus-visible',
    'outline-offset',
    'min-height: 44px',
    'minmax(0, 1fr)',
    'flex-wrap',
    'overflow-wrap',
    '@media',
  ])
    assert(css.includes(token), token);
  assert(!/@import|https?:\/\//.test(css));
  // Source evidence only: real keyboard, screen-reader, layout and browser races remain NOT_RUN.
});

for (const [label, error] of [
  [
    '503 after restoration',
    new clients.AdminApiError('DEPENDENCY_UNAVAILABLE', 503),
  ],
  [
    'invalid current-user response after restoration',
    new clients.AdminApiError('INVALID_RESPONSE'),
  ],
] as const)
  test(
    label +
      ' preserves mutation uncertainty rather than offering unsafe replay',
    async (t) => {
      const f = fixture(t, {
          me: async () => {
            throw error;
          },
        }),
        h = host();
      const detach = helpers.attachAdminLifecycle(f.controller, h);
      await f.controller.restore();
      const state = f.controller.getSnapshot();
      assert.equal(state.status, 'uncertain');
      const html = app(state).html();
      assert(html.includes('could not be confirmed'));
      assert(/disabled=""[^>]*>Restore existing session/.test(html));
      assert(!html.includes('Retry session check'));
      assert(!html.includes('Welcome,'));
      await f.controller.restore();
      assert.deepEqual(f.calls, ['refresh']);
      detach();
    },
  );
test('read-only revalidation 503 supports explicit new restoration with fresh eligibility', async (t) => {
  let unavailable = false;
  const f = fixture(t, {
      me: async () => {
        if (unavailable)
          throw new clients.AdminApiError('DEPENDENCY_UNAVAILABLE', 503);
        return user;
      },
    }),
    h = host();
  const detach = helpers.attachAdminLifecycle(f.controller, h);
  await f.controller.restore();
  assert.equal(f.controller.getSnapshot().status, 'eligible');
  unavailable = true;
  await f.controller.revalidate();
  assert.equal(f.controller.getSnapshot().status, 'unavailable');
  const html = app(f.controller.getSnapshot()).html();
  assert(html.includes('temporarily unavailable'));
  assert(html.includes('Retry session check'));
  unavailable = false;
  await f.controller.restore();
  assert.equal(f.controller.getSnapshot().status, 'eligible');
  assert.deepEqual(f.calls, ['refresh', 'refresh']);
  detach();
});
test('backgrounding a pending eligibility read refuses late data and never rotates refresh again', async (t) => {
  const response = deferred<contracts.CurrentUser>();
  const f = fixture(t, { me: async () => response.promise }),
    h = host();
  const detach = helpers.attachAdminLifecycle(f.controller, h),
    pending = f.controller.restore();
  await flush();
  h.visibility('hidden');
  h.fire('visibilitychange');
  response.resolve(user);
  await pending;
  assert.equal(f.controller.getSnapshot().status, 'uncertain');
  h.visibility('visible');
  h.fire('focus');
  await flush();
  assert.equal(f.controller.getSnapshot().user, null);
  assert.deepEqual(f.calls, ['refresh']);
  detach();
});
test('initial hidden attachment remains passive and cannot expose a retained projection', async (t) => {
  const f = fixture(t),
    h = host();
  f.controller.connect();
  await f.controller.restore();
  h.visibility('hidden');
  const detach = helpers.attachAdminLifecycle(f.controller, h);
  assert.equal(f.controller.getSnapshot().user, null);
  assert.deepEqual(f.calls, ['refresh', 'me']);
  detach();
});
test('host cleanup failure clears authority and irreversibly disposes the affected controller', async (t) => {
  const f = fixture(t),
    h = host();
  const bad = {
    document: h.document,
    window: {
      ...h.window,
      removeEventListener() {
        throw Error('SYNTHETIC_HOST_REFUSAL');
      },
    },
  };
  const detach = helpers.attachAdminLifecycle(f.controller, bad);
  await f.controller.restore();
  assert.equal(f.controller.getSnapshot().status, 'eligible');
  detach();
  assert.equal(f.controller.getSnapshot().user, null);
  assert.equal(f.listeners(), 0);
  h.fire('focus');
  await flush();
  await f.controller.restore();
  assert.notEqual(f.controller.getSnapshot().status, 'eligible');
  assert.deepEqual(f.calls, ['refresh', 'me']);
});
