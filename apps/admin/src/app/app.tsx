import { AdminShell } from '../components/layout/admin-shell';
import { AdminAccess } from '../components/auth/admin-access';
import { isEligibleAdminState, useAdminAuth } from '../hooks/use-admin-auth';
import { TechnologyManager } from '../components/technologies/technology-manager';

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
      {eligible && state.user ? (
        <TechnologyManager
          key={state.user.id}
          auth={controller}
          accountId={state.user.id}
        />
      ) : (
        <AdminAccess
          state={state}
          controller={controller}
          available={available}
        />
      )}
    </AdminShell>
  );
}
