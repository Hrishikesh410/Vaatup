import type { Database } from '../database';

import { initialSchema } from './001-initial-schema';
import type { Migration } from './types';

export type { Migration } from './types';

/**
 * Every migration ever shipped, in order. Add to the end; never edit or
 * renumber a released entry, because devices already store its version.
 */
export const MIGRATIONS: Migration[] = [initialSchema];

export const LATEST_VERSION = MIGRATIONS.reduce(
  (latest, migration) => Math.max(latest, migration.version),
  0
);

async function readVersion(db: Database): Promise<number> {
  const row = await db.queryOne<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export interface MigrationReport {
  from: number;
  to: number;
  applied: string[];
}

/**
 * Brings the database up to {@link LATEST_VERSION}.
 *
 * Each migration runs in its own transaction and bumps `user_version` in the
 * same transaction, so an interrupted upgrade either fully applied a step or
 * did not apply it at all. Nothing here ever drops the database: local data is
 * the only copy that exists.
 */
export async function runMigrations(db: Database): Promise<MigrationReport> {
  const from = await readVersion(db);
  const applied: string[] = [];

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;

    await db.transaction(async (tx) => {
      for (const statement of migration.statements) {
        await tx.execute(statement);
      }
      // PRAGMA does not accept bound parameters; the value is a literal from
      // our own migration list, never user input.
      await tx.execute(`PRAGMA user_version = ${migration.version}`);
    });

    applied.push(`${migration.version}-${migration.name}`);
  }

  return { from, to: await readVersion(db), applied };
}
