import { z } from 'zod';
import {
  detailEnvelope,
  errorEnvelope,
  moduleSchema,
  pathSchema,
  topicSchema,
  pageNumber,
} from '../learning-paths/contracts';
import { learningRoute, validId } from '../learning-paths/routes';
import {
  conceptSchema,
  conceptListEnvelope,
  type ConceptResource,
  type ConceptData,
} from '../concepts/contracts';

const messages = {
  invalid: 'The catalog request is invalid. Return to Explore technologies.',
  missing: 'This content is unavailable.',
  forbidden: 'This site is not permitted to access the catalog.',
  limited: 'Too many requests. Please wait before trying again.',
  unavailable:
    'The catalog is temporarily unavailable. Please try again later.',
  network:
    'The request could not be completed. Check your connection and retry.',
  malformed: 'The service returned an unexpected response.',
  failed: 'The catalog request could not be completed.',
};
export class ConceptError extends Error {
  constructor(public readonly kind: keyof typeof messages) {
    super(messages[kind]);
  }
}
export function createConceptClient(
  base: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15000,
) {
  if (!URL.canParse(base)) throw new ConceptError('failed');
  const parsed = new URL(base);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new ConceptError('failed');
  const root = base.replace(/\/$/, '');
  return {
    async load(
      resource: ConceptResource,
      rawId: string,
      page: number,
      external: AbortSignal,
    ): Promise<ConceptData> {
      if (
        !validId(rawId) ||
        !pageNumber.safeParse(page).success ||
        (resource === 'concept' && page !== 1)
      )
        throw new ConceptError('invalid');
      const id = rawId.toLowerCase();
      const abort = new AbortController();
      const cancel = () => abort.abort();
      external.addEventListener('abort', cancel, { once: true });
      if (external.aborted) cancel();
      const timer = setTimeout(cancel, timeoutMs);
      const { signal } = abort;
      const check = (value: boolean) => {
        if (!value) throw new ConceptError('malformed');
      };
      const request = async <T>(
        path: string,
        schema: z.ZodType<T>,
      ): Promise<T> => {
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
            throw new ConceptError('malformed');
          const kinds = {
            400: 'invalid',
            403: 'forbidden',
            404: 'missing',
            429: 'limited',
            503: 'unavailable',
          } as const;
          throw new ConceptError(
            kinds[response.status as keyof typeof kinds] ?? 'failed',
          );
        }
        if (response.status !== 200) throw new ConceptError('malformed');
        const result = schema.safeParse(raw);
        if (!result.success) throw new ConceptError('malformed');
        return result.data;
      };
      try {
        const concept =
          resource === 'concept'
            ? (await request('/concepts/' + id, detailEnvelope(conceptSchema)))
                .data
            : null;
        if (concept) check(concept.id === id);
        const topicId = concept?.topicId ?? id;
        const topic = (
          await request('/topics/' + topicId, detailEnvelope(topicSchema))
        ).data;
        check(topic.id === topicId);
        const moduleRecord = (
          await request(
            '/modules/' + topic.moduleId,
            detailEnvelope(moduleSchema),
          )
        ).data;
        check(
          moduleRecord.id === topic.moduleId &&
            moduleRecord.learningPathId === topic.learningPathId &&
            moduleRecord.technologyId === topic.technologyId,
        );
        const path = (
          await request(
            '/learning-paths/' + topic.learningPathId,
            detailEnvelope(pathSchema),
          )
        ).data;
        check(
          path.id === topic.learningPathId &&
            path.technologyId === topic.technologyId,
        );
        const matches = (item: {
          topicId: string;
          moduleId: string;
          learningPathId: string;
          technologyId: string;
        }) =>
          item.topicId === topic.id &&
          item.moduleId === moduleRecord.id &&
          item.learningPathId === path.id &&
          item.technologyId === path.technologyId;
        if (concept) check(matches(concept));
        const crumbs = [
          { title: 'Explore technologies', href: '/explore-technologies' },
          {
            title: 'Learning paths',
            href: learningRoute('technology', path.technologyId),
          },
          { title: path.title, href: learningRoute('path', path.id) },
          {
            title: moduleRecord.title,
            href: learningRoute('module', moduleRecord.id),
          },
        ];
        if (concept) {
          crumbs.push({
            title: topic.title,
            href: learningRoute('topic', topic.id),
          });
          return { topic, concept, crumbs, items: [], totalPages: 0 };
        }
        const list = await request(
          `/concepts?topicId=${id}&page=${page}&limit=20`,
          conceptListEnvelope,
        );
        check(list.meta.page === page && list.data.every(matches));
        return {
          topic,
          concept: null,
          crumbs,
          items: list.data,
          totalPages: list.meta.totalPages,
        };
      } catch (error) {
        if (external.aborted)
          throw new DOMException('Request cancelled', 'AbortError');
        if (signal.aborted) throw new ConceptError('network');
        if (error instanceof ConceptError) throw error;
        throw new ConceptError('network');
      } finally {
        clearTimeout(timer);
        external.removeEventListener('abort', cancel);
      }
    },
  };
}
export type ConceptClient = ReturnType<typeof createConceptClient>;
