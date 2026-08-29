import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { DatabaseError, type Database, type SqlValue } from './database';

/**
 * `expo-sqlite` implementation of the {@link Database} port.
 *
 * Every method funnels through `asDatabaseError`, so a driver-level failure surfaces as a
 * `DatabaseError` instead of leaking `expo-sqlite` internals into the layers
 * above.
 */

async function asDatabaseError<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new DatabaseError(`${operation} failed`, error);
  }
}

class SqliteDatabase implements Database {
  constructor(
    private readonly db: SQLite.SQLiteDatabase,
    /** True while inside `withExclusiveTransactionAsync`, so nesting can join. */
    private readonly inTransaction = false
  ) {}

  async execute(sql: string, params: SqlValue[] = []): Promise<void> {
    await asDatabaseError('execute', () => this.db.runAsync(sql, params));
  }

  async executeWithChanges(sql: string, params: SqlValue[] = []): Promise<number> {
    const result = await asDatabaseError('execute', () => this.db.runAsync(sql, params));
    return result.changes;
  }

  query<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return asDatabaseError('query', () => this.db.getAllAsync<T>(sql, params));
  }

  async queryOne<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    const row = await asDatabaseError('query', () => this.db.getFirstAsync<T>(sql, params));
    return row ?? null;
  }

  async transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    if (this.inTransaction) return work(this);

    let result: T;
    await asDatabaseError('transaction', () =>
      // Exclusive rather than `withTransactionAsync`: it guarantees only the
      // statements inside the callback join the transaction, which matters
      // because unrelated reads can be in flight while an expense is written.
      // The exclusive form is unavailable in the web build, where there is one
      // worker and no concurrent writer to exclude anyway.
      Platform.OS === 'web'
        ? this.db.withTransactionAsync(async () => {
            result = await work(new SqliteDatabase(this.db, true));
          })
        : this.db.withExclusiveTransactionAsync(async (txn) => {
            result = await work(new SqliteDatabase(txn, true));
          })
    );
    // Assigned by the callback above; the await guarantees it ran.
    return result!;
  }

  async executeRaw(sql: string): Promise<void> {
    await asDatabaseError('execute', () => this.db.execAsync(sql));
  }
}

export async function openSqliteDatabase(name: string): Promise<Database> {
  const db = await asDatabaseError('open', () => SQLite.openDatabaseAsync(name));
  const database = new SqliteDatabase(db);
  // WAL keeps reads from blocking the write that creates an expense; foreign
  // keys are off by default in SQLite and the schema depends on them.
  await database.executeRaw('PRAGMA journal_mode = WAL;');
  await database.executeRaw('PRAGMA foreign_keys = ON;');
  return database;
}
