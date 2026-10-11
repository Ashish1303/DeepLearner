import { LearningBrowser } from '../../../../components/learning-paths/learning-browser';
export default async function Page({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  return <LearningBrowser resource="topic" id={topicId} />;
}
