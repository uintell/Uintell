import { FrozenWorkspaceNotice } from "@/components/frozen-workspace-notice";

export default function NotesPage() {
  return (
    <FrozenWorkspaceNotice
      title="Notes are frozen"
      summary="Standalone notes are no longer being developed as a separate product line. The active reader flow centers on imported sources, document pages, grounded answers, and evidence."
    />
  );
}
