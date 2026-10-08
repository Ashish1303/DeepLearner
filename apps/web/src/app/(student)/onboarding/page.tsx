import type { Metadata } from 'next';
import { OnboardingWizard } from '../../../components/onboarding/onboarding-wizard';
export const metadata: Metadata = {
  title: 'Student onboarding — DeepLearner',
  robots: { index: false, follow: false },
};
export default function OnboardingPage() {
  return <OnboardingWizard />;
}
