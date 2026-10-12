import { ConceptBrowser } from '../../../../components/concepts/concept-browser';
export default async function Page({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  return <ConceptBrowser resource="topic" id={topicId} />;
}
