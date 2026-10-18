'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from './use-auth';
import { env } from '../lib/env';
import { createPracticeClient } from '../lib/api/practice-client';
import { createPracticeController } from '../lib/practice/practice-controller';
// The parent mounts a fresh instance for each eligible account/Concept identity.
// Type switching stays inside this controller: cancel() disposes ALL type drafts.
export function usePractice(accountId: string, conceptId: string) {
  const { controller: auth } = useAuth();
  const [controller] = useState(() =>
    createPracticeController(
      createPracticeClient(env.NEXT_PUBLIC_API_BASE_URL),
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
