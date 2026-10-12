import { ConceptBrowser } from '../../../../components/concepts/concept-browser';
export default async function Page({
  params,
}: {
  params: Promise<{ conceptId: string }>;
}) {
  const { conceptId } = await params;
  return <ConceptBrowser resource="concept" id={conceptId} />;
}
