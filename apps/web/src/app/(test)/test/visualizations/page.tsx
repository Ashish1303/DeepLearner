import { notFound } from 'next/navigation';
import { VisualizationFixture } from './fixture-client';

export const dynamic = 'force-dynamic';

export default function VisualizationFixturePage() {
  if (process.env.DEEPLEARNER_BROWSER_FIXTURE !== '1') notFound();
  return <VisualizationFixture />;
}
