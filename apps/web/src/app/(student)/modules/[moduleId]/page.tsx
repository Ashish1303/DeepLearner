import { LearningBrowser } from '../../../../components/learning-paths/learning-browser';
export default async function Page({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  return <LearningBrowser resource="module" id={moduleId} />;
}
