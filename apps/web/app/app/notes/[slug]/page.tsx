import { NotePageWorkspace } from "@/components/note-page-workspace";

export default async function NotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <NotePageWorkspace slug={slug} />;
}
