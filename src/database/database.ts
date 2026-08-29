/**
 * The narrow contract every persistence driver implements.
 *
 * Repositories are written against this port rather than against `expo-sqlite`
 * directly, which keeps two things true: the SQL lives in one layer, and the
 * driver can be swapped (native SQLite today, a different engine on web or in
 * tests) without touching a repository, service or screen.
 */

export type SqlValue = string | number | null;

export interface Database {
  /** Runs a write statement. */
  execute(sql: string, params?: SqlValue[]): Promise<void>;
  /** Runs a write statement and reports how many rows it touched. */
  executeWithChanges(sql: string, params?: SqlValue[]): Promise<number>;
  query<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /**
   * Runs `work` inside a transaction, committing on success and rolling back on
   * any thrown error. Nesting is allowed and joins the outer transaction, so a
   * service can call a repository method that also wants atomicity.
   */
  transaction<T>(work: (tx: Database) => Promise<T>): Promise<T>;
  /** Statements that cannot run inside a transaction, e.g. some PRAGMAs. */
  executeRaw(sql: string): Promise<void>;
}

/** Thrown when the database itself fails; services map this to domain errors. */
export class DatabaseError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}
