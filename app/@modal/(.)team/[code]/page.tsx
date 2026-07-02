import { Modal } from "@/components/Modal";
import { TeamDetail } from "@/components/TeamDetail";

// Intercepted route: when navigating from the bracket, the team detail blooms
// as a modal over the dimmed sunburst instead of a full page navigation.
export const dynamic = "force-dynamic";

export default async function TeamModal({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <Modal>
      <TeamDetail code={code} />
    </Modal>
  );
}
