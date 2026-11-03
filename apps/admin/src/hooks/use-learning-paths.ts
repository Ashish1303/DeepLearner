import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AdminController } from '../lib/auth/admin-controller';
import { createLearningPathController } from '../lib/learning-paths/learning-path-controller';

export function useLearningPaths(auth: AdminController, accountId: string) {
  const [controller] = useState(() =>
    createLearningPathController(auth, accountId),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  useEffect(() => {
    const disconnect = controller.connect();
    void controller.parents(1);
    return disconnect;
  }, [controller]);
  return { state, controller };
}
