import { SourceDetailWorkspace } from "@/components/source-detail-workspace";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ sourceType: string; sourceName: string }>;
}) {
  const { sourceType, sourceName } = await params;
  return <SourceDetailWorkspace sourceType={decodeURIComponent(sourceType)} sourceName={decodeURIComponent(sourceName)} />;
}
