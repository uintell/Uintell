import { FrozenWorkspaceNotice } from "@/components/frozen-workspace-notice";

export default function CollectionsPage() {
  return (
    <FrozenWorkspaceNotice
      title="Collections are frozen"
      summary="Curated bundles are not part of the focused reader flow right now. The active path is source import, library browsing, reading, and ask-page answers with citations."
    />
  );
}
