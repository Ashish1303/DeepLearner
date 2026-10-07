'use client';

import {
  createContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { env } from '../../lib/env';
import { createApiClient } from '../../lib/api/client';
import {
  createAuthController,
  type AuthController,
  type AuthState,
} from '../../lib/auth/auth-controller';
import { createBrowserCoordination } from '../../lib/auth/browser-coordination';

export const AuthContext = createContext<{
  controller: AuthController;
  state: AuthState;
} | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() =>
    createAuthController(
      createApiClient(env.NEXT_PUBLIC_API_BASE_URL),
      createBrowserCoordination(),
    ),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  useEffect(() => controller.connect(), [controller]);
  return (
    <AuthContext.Provider value={{ controller, state }}>
      {children}
    </AuthContext.Provider>
  );
}
