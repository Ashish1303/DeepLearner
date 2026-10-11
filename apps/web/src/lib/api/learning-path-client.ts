import { z } from 'zod';
import {
  detailEnvelope,
  listEnvelope,
  pathSchema,
  moduleSchema,
  topicSchema,
  errorEnvelope,
  pageNumber,
  type BrowserData,
} from '../learning-paths/contracts';
import {
  learningRoute,
  validId,
  type Resource,
} from '../learning-paths/routes';
const messages = {
  invalid: 'The catalog request is invalid. Return to Explore technologies.',
  missing: 'This catalog item is unavailable.',
  forbidden: 'This site is not permitted to access the catalog.',
  limited: 'Too many requests. Please wait before trying again.',
  unavailable:
    'The catalog is temporarily unavailable. Please try again later.',
  network:
    'The request could not be completed. Check your connection and retry.',
  malformed: 'The service returned an unexpected response.',
  failed: 'The catalog request could not be completed.',
};
export class LearningError extends Error {
  constructor(public readonly kind: keyof typeof messages) {
    super(messages[kind]);
  }
}
export function createLearningPathClient(
  base: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15000,
) {
  if (!URL.canParse(base)) throw new LearningError('failed');
  const url = new URL(base);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new LearningError('failed');
  const root = base.replace(/\/$/, '');
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
  ): Promise<T> {
    signal.throwIfAborted();
    const response = await fetcher(root + path, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal,
    });
    const raw: unknown = await response.json().catch(() => undefined);
    signal.throwIfAborted();
    if (!response.ok) {
      if (!errorEnvelope.safeParse(raw).success)
        throw new LearningError('malformed');
      const kinds = {
        400: 'invalid',
        404: 'missing',
        403: 'forbidden',
        429: 'limited',
        503: 'unavailable',
      } as const;
      throw new LearningError(
        kinds[response.status as keyof typeof kinds] ?? 'failed',
      );
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new LearningError('malformed');
    return parsed.data;
  }
  return {
    async load(
      resource: Resource,
      rawId: string,
      page: number,
      external: AbortSignal,
    ): Promise<BrowserData> {
      if (!validId(rawId) || !pageNumber.safeParse(page).success)
        throw new LearningError('invalid');
      const id = rawId.toLowerCase();
      const abort = new AbortController();
      const cancel = () => abort.abort();
      external.addEventListener('abort', cancel, { once: true });
      if (external.aborted) cancel();
      const timer = setTimeout(cancel, timeoutMs);
      const signal = abort.signal;
      const check = (condition: boolean) => {
        if (!condition) throw new LearningError('malformed');
      };
      const pathDetail = async (value: string) => {
        const result = await request(
          '/learning-paths/' + value,
          detailEnvelope(pathSchema),
          signal,
        );
        check(result.data.id === value);
        return result.data;
      };
      const moduleDetail = async (value: string) => {
        const result = await request(
          '/modules/' + value,
          detailEnvelope(moduleSchema),
          signal,
        );
        check(result.data.id === value);
        return result.data;
      };
      try {
        const crumbs = [
          { title: 'Explore technologies', href: '/explore-technologies' },
        ];
        if (resource === 'technology') {
          const result = await request(
            `/learning-paths?technologyId=${id}&page=${page}&limit=20`,
            listEnvelope(pathSchema),
            signal,
          );
          check(
            result.meta.page === page &&
              result.data.every((item) => item.technologyId === id),
          );
          return {
            title: 'Learning paths',
            description: null,
            crumbs,
            items: result.data,
            totalPages: result.meta.totalPages,
          };
        }
        const topic =
          resource === 'topic'
            ? (
                await request(
                  '/topics/' + id,
                  detailEnvelope(topicSchema),
                  signal,
                )
              ).data
            : null;
        if (topic) check(topic.id === id);
        const moduleRecord =
          resource === 'module' || topic
            ? await moduleDetail(topic?.moduleId ?? id)
            : null;
        const path = await pathDetail(moduleRecord?.learningPathId ?? id);
        if (moduleRecord)
          check(moduleRecord.technologyId === path.technologyId);
        if (topic && moduleRecord)
          check(
            topic.technologyId === path.technologyId &&
              topic.learningPathId === path.id &&
              topic.moduleId === moduleRecord.id,
          );
        crumbs.push({
          title: 'Learning paths',
          href: learningRoute('technology', path.technologyId),
        });
        if (resource === 'path') {
          const result = await request(
            `/modules?learningPathId=${id}&page=${page}&limit=20`,
            listEnvelope(moduleSchema),
            signal,
          );
          check(
            result.meta.page === page &&
              result.data.every(
                (item) =>
                  item.learningPathId === path.id &&
                  item.technologyId === path.technologyId,
              ),
          );
          return {
            ...path,
            crumbs,
            items: result.data,
            totalPages: result.meta.totalPages,
          };
        }
        crumbs.push({
          title: path.title,
          href: learningRoute('path', path.id),
        });
        if (!moduleRecord) throw new LearningError('malformed');
        if (resource === 'module') {
          const result = await request(
            `/topics?moduleId=${id}&page=${page}&limit=20`,
            listEnvelope(topicSchema),
            signal,
          );
          check(
            result.meta.page === page &&
              result.data.every(
                (item) =>
                  item.moduleId === moduleRecord.id &&
                  item.learningPathId === path.id &&
                  item.technologyId === path.technologyId,
              ),
          );
          return {
            ...moduleRecord,
            crumbs,
            items: result.data,
            totalPages: result.meta.totalPages,
          };
        }
        crumbs.push({
          title: moduleRecord.title,
          href: learningRoute('module', moduleRecord.id),
        });
        if (!topic) throw new LearningError('malformed');
        return { ...topic, crumbs, items: [], totalPages: 0 };
      } catch (error) {
        if (external.aborted)
          throw new DOMException('Request cancelled', 'AbortError');
        if (signal.aborted) throw new LearningError('network');
        if (error instanceof LearningError) throw error;
        throw new LearningError('network');
      } finally {
        clearTimeout(timer);
        external.removeEventListener('abort', cancel);
      }
    },
  };
}
export type LearningPathClient = ReturnType<typeof createLearningPathClient>;
