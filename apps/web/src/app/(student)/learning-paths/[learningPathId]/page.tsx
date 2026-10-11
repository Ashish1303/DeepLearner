import { LearningBrowser } from '../../../../components/learning-paths/learning-browser';
export default async function Page({
  params,
}: {
  params: Promise<{ learningPathId: string }>;
}) {
  const { learningPathId } = await params;
  return <LearningBrowser resource="path" id={learningPathId} />;
}
