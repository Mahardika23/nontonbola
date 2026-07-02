import Link from "next/link";
import { TeamDetail } from "@/components/TeamDetail";

// Standalone team page — shown on a direct visit / hard refresh / shared link.
export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-[var(--gold)]"
      >
        ← Back to bracket
      </Link>
      <div className="mt-4 rounded-3xl border border-[var(--gold)]/15 bg-white/[0.02] p-6 sm:p-8">
        <TeamDetail code={code} />
      </div>
    </main>
  );
}
