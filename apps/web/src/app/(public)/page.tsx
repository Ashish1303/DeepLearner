import { PublicShell } from '../../components/layout/public-shell';
import type { Metadata } from 'next';
import { HeroSection } from '../../components/landing/hero-section';
import { LearningMethodSection } from '../../components/landing/learning-method-section';
import { VisualLearningSection } from '../../components/landing/visual-learning-section';
import { CodeVisualizerSection } from '../../components/landing/code-visualizer-section';
import { TechnologiesSection } from '../../components/landing/technologies-section';
import { ProgressPreviewSection } from '../../components/landing/progress-preview-section';
import { InterviewPreviewSection } from '../../components/landing/interview-preview-section';
import { FinalCtaSection } from '../../components/landing/final-cta-section';

export const metadata: Metadata = {
  title: 'DeepLearner — See it. Understand it. Remember it.',
  description:
    'Explore a visual-first approach to programming: clear explanations, code previews, practice, revision, and interview preparation.',
};

export default function HomePage() {
  return (
    <PublicShell landing>
      <HeroSection />
      <LearningMethodSection />
      <VisualLearningSection />
      <CodeVisualizerSection />
      <TechnologiesSection />
      <ProgressPreviewSection />
      <InterviewPreviewSection />
      <FinalCtaSection />
    </PublicShell>
  );
}
