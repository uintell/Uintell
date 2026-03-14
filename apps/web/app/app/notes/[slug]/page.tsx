import { FrozenWorkspaceNotice } from "@/components/frozen-workspace-notice";

export default function NotePage() {
  return (
    <FrozenWorkspaceNotice
      title="This notes page is frozen"
      summary="Legacy notes URLs remain available only as a compatibility surface. The maintained product path is library pages with ask-this-page AI, citations, and related reading."
    />
  );
}
