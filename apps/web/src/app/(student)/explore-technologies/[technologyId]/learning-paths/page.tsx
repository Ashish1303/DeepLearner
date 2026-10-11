import { LearningBrowser } from '../../../../../components/learning-paths/learning-browser';
export default async function Page({
  params,
}: {
  params: Promise<{ technologyId: string }>;
}) {
  const { technologyId } = await params;
  return <LearningBrowser resource="technology" id={technologyId} />;
}
