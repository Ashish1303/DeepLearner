import { AdminShell } from '../components/layout/admin-shell';
import { AdminAccess } from '../components/auth/admin-access';
import { isEligibleAdminState, useAdminAuth } from '../hooks/use-admin-auth';

export function App() {
  const { state, controller, available } = useAdminAuth();
  const eligible = available && isEligibleAdminState(state);
  return (
    <AdminShell
      session={
        eligible && state.user
          ? {
              user: state.user,
              onLogout: () => {
                void controller.logout();
              },
            }
          : null
      }
    >
      <AdminAccess
        state={state}
        controller={controller}
        available={available}
      />
    </AdminShell>
  );
}
