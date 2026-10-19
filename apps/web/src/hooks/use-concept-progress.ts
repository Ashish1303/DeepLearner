'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from './use-auth';
import { env } from '../lib/env';
import { createProgressClient } from '../lib/api/progress-client';
import { createProgressController } from '../lib/progress/progress-controller';
export function useConceptProgress(accountId: string, conceptId: string) {
  const { controller: auth } = useAuth();
  const [controller] = useState(() =>
    createProgressController(
      createProgressClient(env.NEXT_PUBLIC_API_BASE_URL),
      auth,
      accountId,
      conceptId,
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
