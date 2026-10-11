'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createLearningPathClient } from '../lib/api/learning-path-client';
import { createLearningBrowserController } from '../lib/learning-paths/learning-browser-controller';
import type { Resource } from '../lib/learning-paths/routes';
import { env } from '../lib/env';
// The caller keys the owning component by account, resource and ID.
export function useLearningBrowser(resource: Resource, id: string) {
  const [controller] = useState(() =>
    createLearningBrowserController(
      createLearningPathClient(env.NEXT_PUBLIC_API_BASE_URL),
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
