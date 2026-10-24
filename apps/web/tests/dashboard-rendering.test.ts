import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { conceptRoute, difficultyLabels } from '../src/lib/concepts/contracts';
import {
  dashboardData,
  parseDashboardPage,
  type DashboardData,
} from '../src/lib/dashboard/contracts';
import {
  createDashboardClient,
  DashboardError,
} from '../src/lib/api/dashboard-client';
import {
  createDashboardController,
  type DashboardState,
  type DashboardController,
} from '../src/lib/dashboard/dashboard-controller';
import type {
  AuthController,
  AuthState,
} from '../src/lib/auth/auth-controller';
import type { CurrentUser } from '../src/lib/api/contracts';

const require = createRequire(import.meta.url);
const id = (n: number) => n.toString(16).padStart(24, '0');
const user: CurrentUser = {
  id: id(100),
  firstName: 'Synthetic',
  lastName: 'Student',
  email: 'student@example.invalid',
  emailVerified: true,
  status: 'ACTIVE',
  role: 'STUDENT',
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: '2026-10-24T00:00:00.000Z',
};
const authorized: AuthState = {
  status: 'authenticated',
  user,
  pending: false,
  message: '',
};
const at = '2026-10-24T00:00:00.000Z';
const row = (n: number) => ({
  concept: {
    id: id(n),
    title: 'Concept ' + n,
    slug: 'concept-' + n,
    difficulty: 'BEGINNER',
  },
  activity: {
    conceptId: id(n),
    status: 'IN_PROGRESS',
    attemptCount: 2,
    startedAt: at,
    lastActivityAt: at,
  },
  mastery: {
    status: 'EVALUATED',
    result: { classification: 'STRONG', code: 'NONE' },
    unavailableCode: null,
  },
});
function page(count = 1, more = false, start = 1) {
  return dashboardData.parse({
    items: Array.from({ length: count }, (_, i) => row(start + i)),
    pagination: { limit: 5, nextCursor: more ? id(start + count - 1) : null },
  });
}
const ready = (
  data: DashboardData = page(),
  cursor: string | null = null,
): DashboardState => ({ status: 'ready', data, cursor, message: '' });
const actions = () => ({
  refresh: async () => {},
  retry: async () => {},
  next: async () => {},
  first: async () => {},
});
type ViewProps = { state: DashboardState; actions: ReturnType<typeof actions> };
function compile(file: string, load: (name: string) => unknown) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const out: Record<string, unknown> = {};
  new Function('require', 'exports', compiled)(load, out);
  return out;
}
function activity(
  state = ready(),
  auth = authorized,
  react: unknown = require('react'),
) {
  let boundAccount = '';
  const out = compile(
    '../src/components/student/dashboard-activity.tsx',
    (name) => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'next/link')
        return {
          __esModule: true,
          default: ({
            href,
            children,
          }: {
            href: string;
            children: ReactElement;
          }) => createElement('a', { href }, children),
        };
      if (name === '../../hooks/use-auth')
        return { useAuth: () => ({ state: auth }) };
      if (name === '../../hooks/use-dashboard')
        return {
          useDashboard: (account: string) => {
            boundAccount = account;
            return { state, controller: actions() };
          },
        };
      if (name === '../../lib/concepts/contracts')
        return { conceptRoute, difficultyLabels };
      if (name === '../../lib/dashboard/contracts')
        return { parseDashboardPage };
      if (name.endsWith('.css'))
        return {
          __esModule: true,
          default: new Proxy({}, { get: (_target, key) => String(key) }),
        };
      throw Error('Unexpected activity import');
    },
  ) as {
    DashboardActivity: () => ReactElement | null;
    DashboardActivityView: (props: ViewProps) => ReactElement;
  };
  return { ...out, bound: () => boundAccount };
}
const render = (state = ready()) =>
  renderToStaticMarkup(
    createElement(activity(state).DashboardActivityView, {
      state,
      actions: actions(),
    }),
  );

test('eligible Student binds the panel to the current account; every ineligible state mounts nothing', () => {
  const component = activity();
  const element = component.DashboardActivity();
  assert(element);
  assert.equal(element.key, user.id);
  assert.equal((element.props as { accountId: string }).accountId, user.id);
  const html = renderToStaticMarkup(createElement(component.DashboardActivity));
  assert(html.includes('Saved Concept practice'));
  assert.equal(component.bound(), user.id);
  for (const auth of [
    { ...authorized, status: 'anonymous', user: null },
    { ...authorized, status: 'uncertain', user: null },
    { ...authorized, pending: true },
    { ...authorized, user: { ...user, role: 'ADMIN' } },
    { ...authorized, user: { ...user, status: 'SUSPENDED' } },
    { ...authorized, user: { ...user, emailVerified: false } },
  ] as AuthState[])
    assert.equal(activity(ready(), auth).DashboardActivity(), null);
});

test('different authenticated accounts receive distinct component keys', () => {
  const first = activity().DashboardActivity()!;
  const second = activity(ready(), {
    ...authorized,
    user: { ...user, id: id(101) },
  }).DashboardActivity()!;
  assert.notEqual(first.key, second.key);
});

test('saved entries show exact activity, safe Concept route and semantic UTC times', () => {
  const html = render();
  assert(html.includes('href="/concepts/' + id(1) + '"'));
  assert(html.includes('Difficulty: Beginner'));
  assert(html.includes('2 saved practice attempts.'));
  assert.equal((html.match(/<time /g) ?? []).length, 2);
  assert(
    html.includes('dateTime="' + at + '"') ||
      html.includes('datetime="' + at + '"'),
  );
  assert(html.includes('First saved attempt (UTC)'));
  assert(html.includes('Latest saved attempt (UTC)'));
  assert(html.includes('separate from Concept completion'));
  assert(!/<progress|role="progressbar"|<textarea|<script/.test(html));
  assert(!/XP|streak|recommendation|\d+%|Improved since/.test(html));
});

for (const band of ['WEAK', 'IMPROVING', 'STRONG'] as const) {
  test(
    'displays server band ' + band + ' without scoring or temporal claims',
    () => {
      const data = page();
      data.items[0]!.mastery = {
        status: 'EVALUATED',
        result: { classification: band, code: 'NONE' },
        unavailableCode: null,
      };
      const html = render(ready(data));
      assert(html.includes(band[0] + band.slice(1).toLowerCase()));
      assert(!/score|\d+%|improved over|since last/.test(html));
    },
  );
}
for (const [code, text] of [
  ['SCORE_MISSING', 'no qualifying assessment'],
  ['STALE_ASSESSMENT', 'assessment is out of date'],
  ['REVOKED_ASSESSMENT', 'assessment has been withdrawn'],
] as const) {
  test('UNCLASSIFIED explains ' + code + ' without a retained band', () => {
    const data = page();
    data.items[0]!.mastery = {
      status: 'EVALUATED',
      result: { classification: 'UNCLASSIFIED', code },
      unavailableCode: null,
    };
    const html = render(ready(data));
    assert(html.includes(text));
    assert(html.includes('Unclassified'));
    assert(!/>Strong<|>Weak<|>Improving</.test(html));
  });
}
test('ordinary unavailable evidence remains distinct from unclassified assessment', () => {
  const data = page();
  data.items[0]!.mastery = {
    status: 'UNAVAILABLE',
    result: null,
    unavailableCode: 'LOCAL_QUALIFICATION_UNAVAILABLE',
  };
  const html = render(ready(data));
  assert(html.includes('Classification unavailable'));
  assert(!html.includes('Unclassified'));
});

test('empty is an honest saved-activity message and explicit Explore link', () => {
  const html = render(ready(page(0)));
  assert(html.includes('No saved Concept practice is available.'));
  assert(html.includes('href="/explore-technologies"'));
  assert(!html.includes('No historical attempts'));
  assert(!html.includes('<time'));
});
for (const status of ['idle', 'loading'] as const) {
  test(status + ' announces pending work without rendering old entries', () => {
    const html = render({
      status,
      data: page(),
      cursor: null,
      message: 'PRIVATE',
    });
    assert(html.includes('aria-busy="true"'));
    assert(html.includes('Loading saved Concept practice.'));
    assert(!html.includes('Concept 1'));
    assert(!html.includes('PRIVATE'));
  });
}
for (const [status, text] of [
  ['denied', 'not available for this account'],
  ['unavailable', 'temporarily unavailable'],
  ['rate-limited', 'Please wait before retrying'],
  ['error', 'could not be confirmed'],
] as const) {
  test(
    status +
      ' uses safe alert and native manual Retry, never error details or empty fallback',
    () => {
      const html = render({
        status,
        data: page(),
        cursor: null,
        message: 'PRIVATE raw server details',
      });
      assert(html.includes('role="alert"'));
      assert(html.includes(text));
      assert(html.includes('Retry activity</button>'));
      assert(!html.includes('PRIVATE'));
      assert(!html.includes('Concept 1'));
      assert(!html.includes('No saved Concept practice'));
    },
  );
}
test('malformed/private projection and cursor contradiction are refused again at the view boundary', () => {
  for (const data of [
    { ...page(), expectedAnswer: 'PRIVATE' },
    {
      ...page(),
      items: [
        { ...row(1), concept: { ...row(1).concept, id: 'javascript:private' } },
      ],
    },
  ]) {
    const html = render(ready(data as DashboardData));
    assert(html.includes('could not be confirmed'));
    assert(!html.includes('PRIVATE'));
    assert(!html.includes('javascript:'));
    assert(!html.includes('<article'));
  }
  assert(render(ready(page(), id(1))).includes('could not be confirmed'));
});
test('HTML-like titles are escaped and links never use server-provided URL strings', () => {
  const data = page();
  data.items[0]!.concept.title = '<img src=x onerror=alert(1)>';
  const html = render(ready(data));
  assert(html.includes('&lt;img'));
  assert(!/<img|<script/.test(html));
  assert(html.includes('href="/concepts/' + id(1) + '"'));
});
test('pagination exposes only first/next and at most one ordered page', () => {
  const first = render(ready(page(5, true)));
  assert.equal((first.match(/<article /g) ?? []).length, 5);
  assert(first.includes('More results are available.'));
  assert(/disabled=""[^>]*>Back to first results/.test(first));
  assert(!/disabled=""[^>]*>Next results/.test(first));
  const final = render(ready(page(1, false, 6), id(5)));
  assert(!/disabled=""[^>]*>Back to first results/.test(final));
  assert(/disabled=""[^>]*>Next results/.test(final));
  assert(!final.includes('Concept 1'));
  assert(!/Page \d+ of|total Concepts/.test(final));
});

function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children)];
}
test('offline native-button wiring and focus effect follow explicit successful actions only', async () => {
  const refs: { current: unknown }[] = [];
  let pos = 0;
  const effects: (() => void)[] = [];
  const react = {
    useId: () => 'offline-heading',
    useRef(initial: unknown) {
      return refs[pos++] ?? (refs[pos - 1] = { current: initial });
    },
    useEffect(fn: () => void) {
      effects.push(fn);
    },
  };
  const view = activity(ready(), authorized, react).DashboardActivityView;
  const calls: string[] = [];
  const actions = {
    refresh: async () => {
      calls.push('refresh');
    },
    retry: async () => {
      calls.push('retry');
    },
    next: async () => {
      calls.push('next');
    },
    first: async () => {
      calls.push('first');
    },
  };
  const draw = (state: DashboardState) => {
    pos = 0;
    return view({ state, actions });
  };
  const tree = draw(ready(page(5, true)));
  let focused = 0;
  refs[0]!.current = {
    focus() {
      focused++;
    },
  };
  effects.splice(0).forEach((fn) => fn());
  assert.equal(focused, 0);
  const buttons = elements(tree).filter((e) => e.type === 'button');
  const click = (name: string) =>
    (
      buttons.find((e) => e.props.children === name)!.props
        .onClick as () => void
    )();
  click('Next results');
  assert.deepEqual(calls, ['next']);
  draw({ status: 'loading', data: null, cursor: id(5), message: '' });
  effects.splice(0).forEach((fn) => fn());
  assert.equal(focused, 0);
  draw(ready(page(1, false, 6), id(5)));
  effects.splice(0).forEach((fn) => fn());
  assert.equal(focused, 1);
  click('Refresh activity');
  click('Back to first results');
  assert.deepEqual(calls, ['next', 'refresh', 'first']);
  const errorTree = draw({
    status: 'error',
    data: null,
    cursor: id(5),
    message: '',
  });
  const retry = elements(errorTree).find(
    (e) => e.type === 'button' && e.props.children === 'Retry activity',
  )!;
  (retry.props.onClick as () => void)();
  assert.equal(calls.at(-1), 'retry');
  effects.splice(0).forEach((fn) => fn());
  assert.equal(focused, 1);
});

function hookFixture(
  fetcher: typeof fetch,
  base = 'https://example.invalid/api/v1',
) {
  let authState = authorized;
  const authListeners = new Set<() => void>();
  const auth: Pick<
    AuthController,
    'runAuthenticatedRead' | 'getSnapshot' | 'subscribe'
  > = {
    getSnapshot: () => authState,
    subscribe(fn) {
      authListeners.add(fn);
      return () => {
        authListeners.delete(fn);
      };
    },
    async runAuthenticatedRead(expected, signal, operation) {
      assert.equal(expected, user.id);
      signal.throwIfAborted();
      const result = await operation('synthetic-token', signal);
      signal.throwIfAborted();
      return result;
    },
  };
  let controller: DashboardController | undefined;
  let effect: (() => () => void) | undefined;
  const hookModule = compile('../src/hooks/use-dashboard.ts', (name) => {
    if (name === 'react')
      return {
        useState(init: () => DashboardController) {
          controller ??= init();
          return [controller];
        },
        useSyncExternalStore(
          _subscribe: unknown,
          snapshot: () => DashboardState,
        ) {
          return snapshot();
        },
        useEffect(fn: () => () => void) {
          effect = fn;
        },
      };
    if (name === './use-auth') return { useAuth: () => ({ controller: auth }) };
    if (name === '../lib/env')
      return { env: { NEXT_PUBLIC_API_BASE_URL: base } };
    if (name === '../lib/api/dashboard-client')
      return {
        createDashboardClient: (url: string) =>
          createDashboardClient(url, fetcher),
        DashboardError,
      };
    if (name === '../lib/dashboard/dashboard-controller')
      return { createDashboardController };
    throw Error('Unexpected hook import');
  }) as {
    useDashboard: (account: string) => {
      state: DashboardState;
      controller: DashboardController;
    };
  };
  const result = hookModule.useDashboard(user.id);
  return {
    controller: result.controller,
    read: () => hookModule.useDashboard(user.id).state,
    mount: () => effect!(),
    change(patch: Partial<AuthState>) {
      authState = { ...authState, ...patch };
      authListeners.forEach((fn) => fn());
    },
    listeners: () => authListeners.size,
  };
}
test('actual hook wiring defers initial GET to the effect and unmount cancels/erases it', async () => {
  let sends = 0,
    held!: (value: Response) => void,
    signal: AbortSignal | undefined;
  const f = hookFixture(async (_url, init) => {
    sends++;
    signal = init?.signal ?? undefined;
    return new Promise((r) => {
      held = r;
    });
  });
  assert.equal(sends, 0);
  const cleanup = f.mount();
  await Promise.resolve();
  assert.equal(sends, 1);
  assert.equal(f.listeners(), 1);
  cleanup();
  assert(signal?.aborted);
  assert.equal(f.listeners(), 0);
  held(
    Response.json({
      success: true,
      data: page(),
      message: null,
      meta: { requestId: 'r' },
    }),
  );
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(f.read().data, null);
});
test('hook composition clears displayed data on auth change', async () => {
  const f = hookFixture(async () =>
    Response.json({
      success: true,
      data: page(),
      message: null,
      meta: { requestId: 'r' },
    }),
  );
  const cleanup = f.mount();
  await f.controller.load();
  assert(f.read().data);
  f.change({ user: { ...user, id: id(101) } });
  assert.equal(f.read().data, null);
  assert.equal(f.read().status, 'denied');
  cleanup();
});
test('hook configuration refusal is sanitized unavailable, never fake activity', async () => {
  let sends = 0;
  const f = hookFixture(async () => {
    sends++;
    throw Error('must not send');
  }, 'bad');
  const cleanup = f.mount();
  await f.controller.load();
  assert.equal(f.read().status, 'unavailable');
  assert.equal(f.read().data, null);
  assert.equal(sends, 0);
  cleanup();
});
test('hook cleanup/setup replay keeps only the current effect request', async () => {
  let sends = 0;
  const f = hookFixture(async () => {
    sends++;
    return Response.json({
      success: true,
      data: page(),
      message: null,
      meta: { requestId: 'r' },
    });
  });
  const firstCleanup = f.mount();
  firstCleanup();
  const secondCleanup = f.mount();
  await f.controller.load();
  assert.equal(sends, 1);
  assert(f.read().data);
  secondCleanup();
});
test('responsive CSS and semantic live regions preserve keyboard access without a new framework', () => {
  const css = readFileSync(
    new URL(
      '../src/components/student/dashboard-activity.module.css',
      import.meta.url,
    ),
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
    assert(css.includes(token));
  const html = render();
  assert(html.includes('aria-labelledby='));
  assert(html.includes('tabindex="-1"') || html.includes('tabIndex="-1"'));
  assert(html.includes('aria-live="polite"'));
  assert(html.includes('aria-atomic="true"'));
  assert(html.includes('aria-label="Saved practice pagination"'));
});
test('foundation preserves account/profile sections while replacing only the obsolete activity placeholder', () => {
  const out = compile(
    '../src/components/student/dashboard-foundation.tsx',
    (name) => {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '../../hooks/use-auth')
        return {
          useAuth: () => ({
            state: authorized,
            controller: { reloadUser() {} },
          }),
        };
      if (name === './dashboard-activity')
        return {
          DashboardActivity: () =>
            createElement('section', null, 'Verified panel mount'),
        };
      if (name.endsWith('.css')) return {};
      throw Error('Unexpected foundation import');
    },
  ) as { DashboardFoundation: () => ReactElement };
  const html = renderToStaticMarkup(createElement(out.DashboardFoundation));
  for (const text of [
    'Your details',
    'Learning preferences',
    user.email,
    'Refresh account details',
    'Verified panel mount',
  ])
    assert(html.includes(text));
  assert(!html.includes('Room for what comes next'));
  assert(
    !html.includes(
      'Learning paths, practice and progress are not available yet',
    ),
  );
});
