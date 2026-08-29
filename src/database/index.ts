import type { Database } from './database';
import { runMigrations, type MigrationReport } from './migrations';
import { openSqliteDatabase } from './sqlite-database';

export { DatabaseError } from './database';
export type { Database, SqlValue } from './database';

/**
 * The filename keeps the old product name on purpose. It is the path to every
 * expense, settlement and balance already on the device; renaming it would open
 * an empty database and look exactly like data loss.
 */
const DATABASE_NAME = 'quicksplit.db';

let opening: Promise<Database> | null = null;
let report: MigrationReport | null = null;

/**
 * Opens the database and applies pending migrations exactly once per app
 * launch. Concurrent callers share the same promise, so a screen mounting at
 * the same time as the root layout cannot start a second migration run.
 */
export function getDatabase(): Promise<Database> {
  opening ??= (async () => {
    const db = await openSqliteDatabase(DATABASE_NAME);
    report = await runMigrations(db);
    return db;
  })();
  return opening;
}

/** What the last migration run did. Surfaced in the profile screen for support. */
export function lastMigrationReport(): MigrationReport | null {
  return report;
}
