import type { Migration } from './types';

/**
 * The first schema. VaatUp had no SQLite before this migration, so it
 * creates the whole model in one step rather than reconstructing history.
 *
 * Conventions used throughout:
 * - Ids are application-generated text, never SQLite rowids, so a future
 *   backend can own its own id space without the UI noticing.
 * - Money is stored as an integer in the currency's minor unit (paise for INR).
 *   There are no REAL money columns anywhere on purpose.
 * - Timestamps are ISO 8601 strings in UTC.
 * - Records that represent a financial event are soft deleted via `deleted_at`.
 *
 * One deliberate deviation from a literal reading of the brief: there is a
 * single `participants` table instead of separate `friends` and `participants`
 * tables. A friend and an expense participant are the same thing in this
 * product — a person who may or may not use VaatUp — and splitting them
 * would create exactly the duplicate person concept the brief warns against.
 * The row representing the signed-in user carries `is_self = 1`.
 */
const statements: string[] = [
  `CREATE TABLE users (
     id            TEXT PRIMARY KEY NOT NULL,
     name          TEXT NOT NULL,
     email         TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     password_salt TEXT NOT NULL,
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL
   );`,
  // Emails are matched case-insensitively at login, so uniqueness has to be too.
  `CREATE UNIQUE INDEX idx_users_email ON users (lower(email));`,

  `CREATE TABLE participants (
     id             TEXT PRIMARY KEY NOT NULL,
     owner_user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
     -- Set when this person also has a local VaatUp account. A participant
     -- never needs one; this is only here so the user's own row can point at it.
     linked_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
     name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
     phone          TEXT,
     email          TEXT,
     avatar_uri     TEXT,
     is_self        INTEGER NOT NULL DEFAULT 0 CHECK (is_self IN (0, 1)),
     created_at     TEXT NOT NULL,
     updated_at     TEXT NOT NULL,
     deleted_at     TEXT
   );`,
  `CREATE INDEX idx_participants_owner ON participants (owner_user_id, deleted_at);`,
  `CREATE UNIQUE INDEX idx_participants_self ON participants (owner_user_id)
     WHERE is_self = 1;`,

  `CREATE TABLE categories (
     id         TEXT PRIMARY KEY NOT NULL,
     label      TEXT NOT NULL,
     icon       TEXT NOT NULL,
     sort_order INTEGER NOT NULL,
     is_builtin INTEGER NOT NULL DEFAULT 1 CHECK (is_builtin IN (0, 1))
   );`,

  `CREATE TABLE groups (
     id            TEXT PRIMARY KEY NOT NULL,
     owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
     name          TEXT NOT NULL CHECK (length(trim(name)) > 0),
     description   TEXT,
     image_uri     TEXT,
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL,
     deleted_at    TEXT
   );`,
  `CREATE INDEX idx_groups_owner ON groups (owner_user_id, deleted_at);`,

  `CREATE TABLE group_members (
     id             TEXT PRIMARY KEY NOT NULL,
     group_id       TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
     participant_id TEXT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
     created_at     TEXT NOT NULL,
     UNIQUE (group_id, participant_id)
   );`,
  `CREATE INDEX idx_group_members_participant ON group_members (participant_id);`,

  `CREATE TABLE expenses (
     id            TEXT PRIMARY KEY NOT NULL,
     owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
     group_id      TEXT REFERENCES groups (id) ON DELETE SET NULL,
     description   TEXT NOT NULL CHECK (length(trim(description)) > 0),
     -- total_amount = base + tip + tax, and is what the splits must add up to.
     total_amount  INTEGER NOT NULL CHECK (total_amount > 0),
     base_amount   INTEGER NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
     tip_amount    INTEGER NOT NULL DEFAULT 0 CHECK (tip_amount >= 0),
     tax_amount    INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
     currency_code TEXT NOT NULL,
     split_type    TEXT NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage', 'shares')),
     category_id   TEXT NOT NULL REFERENCES categories (id),
     notes         TEXT,
     receipt_uri   TEXT,
     spent_at      TEXT NOT NULL,
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL,
     deleted_at    TEXT
   );`,
  `CREATE INDEX idx_expenses_owner_date ON expenses (owner_user_id, deleted_at, spent_at DESC);`,
  `CREATE INDEX idx_expenses_group ON expenses (group_id, deleted_at);`,
  `CREATE INDEX idx_expenses_category ON expenses (category_id);`,

  `CREATE TABLE expense_payers (
     id             TEXT PRIMARY KEY NOT NULL,
     expense_id     TEXT NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
     participant_id TEXT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
     amount_paid    INTEGER NOT NULL CHECK (amount_paid >= 0),
     UNIQUE (expense_id, participant_id)
   );`,
  `CREATE INDEX idx_expense_payers_participant ON expense_payers (participant_id);`,

  `CREATE TABLE expense_splits (
     id             TEXT PRIMARY KEY NOT NULL,
     expense_id     TEXT NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
     participant_id TEXT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
     split_type     TEXT NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage', 'shares')),
     -- What the user typed: paise for exact, percent for percentage, share
     -- count for shares, 1 for equal. Kept alongside the money so the original
     -- configuration can be reopened for editing rather than reverse-engineered.
     input_value    REAL NOT NULL DEFAULT 0 CHECK (input_value >= 0),
     amount_owed    INTEGER NOT NULL CHECK (amount_owed >= 0),
     UNIQUE (expense_id, participant_id)
   );`,
  `CREATE INDEX idx_expense_splits_participant ON expense_splits (participant_id);`,

  `CREATE TABLE expense_items (
     id         TEXT PRIMARY KEY NOT NULL,
     expense_id TEXT NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
     name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
     amount     INTEGER NOT NULL CHECK (amount > 0),
     position   INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL
   );`,
  `CREATE INDEX idx_expense_items_expense ON expense_items (expense_id, position);`,

  `CREATE TABLE expense_item_assignments (
     id             TEXT PRIMARY KEY NOT NULL,
     item_id        TEXT NOT NULL REFERENCES expense_items (id) ON DELETE CASCADE,
     participant_id TEXT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
     UNIQUE (item_id, participant_id)
   );`,

  `CREATE TABLE expense_comments (
     id                    TEXT PRIMARY KEY NOT NULL,
     expense_id            TEXT NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
     author_participant_id TEXT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
     comment               TEXT NOT NULL CHECK (length(trim(comment)) > 0),
     created_at            TEXT NOT NULL,
     updated_at            TEXT NOT NULL,
     deleted_at            TEXT
   );`,
  `CREATE INDEX idx_expense_comments_expense ON expense_comments (expense_id, deleted_at, created_at);`,

  `CREATE TABLE settlements (
     id                  TEXT PRIMARY KEY NOT NULL,
     owner_user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
     group_id            TEXT REFERENCES groups (id) ON DELETE SET NULL,
     -- Set when the settlement came from marking one share paid on one expense,
     -- which is how the original bill flow's "mark paid" is recorded. Null for a
     -- standalone settle up covering a whole balance.
     expense_id          TEXT REFERENCES expenses (id) ON DELETE CASCADE,
     from_participant_id TEXT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
     to_participant_id   TEXT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
     amount              INTEGER NOT NULL CHECK (amount > 0),
     currency_code       TEXT NOT NULL,
     settled_at          TEXT NOT NULL,
     notes               TEXT,
     created_at          TEXT NOT NULL,
     updated_at          TEXT NOT NULL,
     deleted_at          TEXT,
     CHECK (from_participant_id <> to_participant_id)
   );`,
  `CREATE INDEX idx_settlements_owner ON settlements (owner_user_id, deleted_at, settled_at DESC);`,
  `CREATE INDEX idx_settlements_group ON settlements (group_id, deleted_at);`,
  `CREATE INDEX idx_settlements_expense ON settlements (expense_id, deleted_at);`,
  `CREATE INDEX idx_settlements_people ON settlements (from_participant_id, to_participant_id);`,

  `CREATE TABLE recurring_expenses (
     id            TEXT PRIMARY KEY NOT NULL,
     owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
     group_id      TEXT REFERENCES groups (id) ON DELETE SET NULL,
     description   TEXT NOT NULL CHECK (length(trim(description)) > 0),
     total_amount  INTEGER NOT NULL CHECK (total_amount > 0),
     currency_code TEXT NOT NULL,
     category_id   TEXT NOT NULL REFERENCES categories (id),
     split_type    TEXT NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage', 'shares')),
     frequency     TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
     notes         TEXT,
     -- The payer and split configuration to reuse, as JSON. It is a template
     -- rather than rows because it is not itself a financial record.
     template      TEXT NOT NULL,
     next_due_at   TEXT NOT NULL,
     last_run_at   TEXT,
     is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL,
     deleted_at    TEXT
   );`,
  `CREATE INDEX idx_recurring_owner ON recurring_expenses (owner_user_id, deleted_at, next_due_at);`,
];

const CATEGORIES: [id: string, label: string, icon: string][] = [
  ['food', 'Food', '🍽️'],
  ['travel', 'Travel', '✈️'],
  ['transport', 'Transport', '🚕'],
  ['accommodation', 'Accommodation', '🏨'],
  ['entertainment', 'Entertainment', '🎬'],
  ['shopping', 'Shopping', '🛍️'],
  ['utilities', 'Utilities', '💡'],
  ['rent', 'Rent', '🏠'],
  ['other', 'Other', '🧾'],
];

for (const [index, [id, label, icon]] of CATEGORIES.entries()) {
  statements.push(
    `INSERT INTO categories (id, label, icon, sort_order, is_builtin)
     VALUES ('${id}', '${label}', '${icon}', ${index}, 1);`
  );
}

export const initialSchema: Migration = {
  version: 1,
  name: 'initial-schema',
  statements,
};
