export interface Migration {
  /** Monotonic, matching SQLite's `user_version`. Never reused or reordered. */
  version: number;
  name: string;
  /** Executed in order inside a single transaction. */
  statements: string[];
}
