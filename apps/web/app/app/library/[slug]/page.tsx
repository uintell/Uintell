import { DocumentReaderWorkspace } from "@/components/document-reader-workspace";

export default async function DocumentReaderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DocumentReaderWorkspace slug={slug} />;
}
