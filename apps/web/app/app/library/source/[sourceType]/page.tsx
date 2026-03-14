import { LibraryWorkspace } from "@/components/library-workspace";

export default async function LibrarySourcePage({ params }: { params: Promise<{ sourceType: string }> }) {
  const { sourceType } = await params;
  return <LibraryWorkspace initialSourceType={sourceType} />;
}
