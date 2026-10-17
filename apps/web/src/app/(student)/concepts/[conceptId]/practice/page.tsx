import { PracticeBrowser } from '../../../../../components/practice/practice-browser';
export default async function PracticePage({
  params,
}: {
  params: Promise<{ conceptId: string }>;
}) {
  const { conceptId } = await params;
  return <PracticeBrowser conceptId={conceptId} />;
}
