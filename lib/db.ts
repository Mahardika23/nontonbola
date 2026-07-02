import Database from "better-sqlite3";
import { join } from "node:path";

// A single read-only handle to the local SQLite cache. The app only ever reads;
// the ingest script (and, later, the scheduler) are the only writers. Cached on
// globalThis so dev HMR doesn't open a new handle on every reload.
const g = globalThis as unknown as { __nbDb?: Database.Database };

export function db(): Database.Database {
  if (g.__nbDb) return g.__nbDb;
  const file = join(process.cwd(), "db", "worldcup.sqlite");
  g.__nbDb = new Database(file, { readonly: true, fileMustExist: true });
  return g.__nbDb;
}
