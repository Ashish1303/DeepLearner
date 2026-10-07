export function dashboardDestination(
  value: string | null | undefined,
): '/dashboard' {
  // A closed allowlist; never pass a caller-controlled URL to the router.
  return value === '/dashboard' ? value : '/dashboard';
}
export const loginDestination = '/login?next=/dashboard';
