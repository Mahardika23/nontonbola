import { db } from "@/lib/db";

// Liveness + readiness: confirms the server is up and the SQLite cache is readable.
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const { n } = db().prepare("SELECT COUNT(*) AS n FROM teams").get() as {
      n: number;
    };
    return Response.json({ status: "ok", teams: n });
  } catch (err) {
    return Response.json(
      { status: "error", error: String(err) },
      { status: 503 },
    );
  }
}
