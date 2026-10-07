import type { ReactNode } from 'react';
import { AuthBoundary } from '../../components/auth/auth-boundary';
import { StudentShell } from '../../components/student/student-shell';
export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <AuthBoundary>
      <StudentShell>{children}</StudentShell>
    </AuthBoundary>
  );
}
