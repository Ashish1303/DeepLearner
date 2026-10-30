import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AdminController } from '../lib/auth/admin-controller';
import { createTechnologyController } from '../lib/technologies/technology-controller';

export function useTechnologies(auth: AdminController, accountId: string) {
  const [controller] = useState(() =>
    createTechnologyController(auth, accountId),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  useEffect(() => {
    const disconnect = controller.connect();
    if (!controller.getSnapshot().needsReconciliation) void controller.list(1);
    return disconnect;
  }, [controller]);
  return { state, controller };
}
