'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createConceptClient } from '../lib/api/concept-client';
import { createConceptController } from '../lib/concepts/concept-controller';
import type { ConceptResource } from '../lib/concepts/contracts';
import { env } from '../lib/env';
// ConceptBrowser keys the owner by authenticated account, resource and ID.
export function useConceptBrowser(resource: ConceptResource, id: string) {
  const [controller] = useState(() =>
    createConceptController(
      createConceptClient(env.NEXT_PUBLIC_API_BASE_URL),
      resource,
      id,
    ),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    void controller.load();
    return () => controller.cancel();
  }, [controller]);
  return { state, controller };
}
