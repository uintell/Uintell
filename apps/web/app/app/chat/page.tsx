import { FrozenWorkspaceNotice } from "@/components/frozen-workspace-notice";

export default function ChatPage() {
  return (
    <FrozenWorkspaceNotice
      title="Chat is frozen"
      summary="Generic chat is no longer part of the active product surface. Use page-scoped AI from the reader instead so answers stay grounded in a source and citation trail."
    />
  );
}
