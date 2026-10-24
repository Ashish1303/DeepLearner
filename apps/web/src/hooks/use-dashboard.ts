'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from './use-auth';
import { env } from '../lib/env';
import {
  createDashboardClient,
  DashboardError,
  type DashboardClient,
} from '../lib/api/dashboard-client';
import { createDashboardController } from '../lib/dashboard/dashboard-controller';

export function useDashboard(accountId: string) {
  const { controller: auth } = useAuth();
  const [controller] = useState(() => {
    let client: DashboardClient;
    try {
      client = createDashboardClient(env.NEXT_PUBLIC_API_BASE_URL);
    } catch {
      // Configuration uncertainty can only refuse; it cannot provide fake data.
      client = {
        async load() {
          throw new DashboardError('unavailable');
        },
      };
    }
    return createDashboardController(client, auth, accountId);
  });
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
