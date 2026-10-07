import type { Metadata } from 'next';
import { DashboardFoundation } from '../../../components/student/dashboard-foundation';
export const metadata: Metadata = {
  title: 'Dashboard — DeepLearner',
  robots: { index: false, follow: false },
};
export default function DashboardPage() {
  return <DashboardFoundation />;
}
