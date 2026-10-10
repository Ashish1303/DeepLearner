import type { Metadata } from 'next';
import { TechnologyCatalog } from '../../../components/technologies/technology-catalog';
export const metadata: Metadata = {
  title: 'Explore technologies — DeepLearner',
  robots: { index: false, follow: false },
};
export default function ExploreTechnologiesPage() {
  return <TechnologyCatalog />;
}
