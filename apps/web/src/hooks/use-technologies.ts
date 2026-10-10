'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createTechnologyClient } from '../lib/api/technology-client';
import { createCatalogController } from '../lib/technologies/catalog-controller';
import { env } from '../lib/env';
export function useTechnologies() {
  const [controller] = useState(() =>
    createCatalogController(
      createTechnologyClient(env.NEXT_PUBLIC_API_BASE_URL),
    ),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    void controller.load(1);
    return () => controller.cancel();
  }, [controller]);
  return { state, controller };
}
