import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AdminController } from '../lib/auth/admin-controller';
import { createProposalController } from '../lib/learning-path-proposals/proposal-controller';
export function useLearningPathProposal(
  auth: AdminController,
  accountId: string,
) {
  const [controller] = useState(() =>
    createProposalController(auth, accountId),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  useEffect(() => controller.connect(), [controller]);
  useEffect(() => {
    if (!controller.needsWarning()) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (controller.needsWarning()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [controller, state]);
  return { state, controller };
}
