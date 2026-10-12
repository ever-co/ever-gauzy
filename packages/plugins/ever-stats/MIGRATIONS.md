# Migrations of @gauzy/plugin-ever-stats

Plugins cannot carry their own migrations yet, so the tables of this plugin are created by migrations in `packages/core/src/lib/database/migrations/`. Move them here once plugins can own migrations.

| Migration | Creates | Notes |
|---|---|---|
| `1790000021000-EverInstance.ts` | `ever_instance` | Owned by `@gauzy/plugin-ever-instance` (see its `MIGRATIONS.md`). |
| `1790000021100-EverStatsReport.ts` | `ever_stats_report`, `ever_stats_lease`, index `IDX_ever_stats_report_created_at` | This plugin. |

Both are hand-written for Postgres, MySQL and SQLite, use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` (running `up` twice is harmless), create new empty tables only (no foreign key, no change to an existing table, no statement per tenant or per row), and take a transaction-scoped advisory lock on Postgres so two API processes booting together run them one after the other. `down` drops the tables. They run whether or not the plugin is loaded; the tables stay empty when it is not.

## `ever_stats_report`

| Column | Type | Meaning |
|---|---|---|
| `id` | varchar(36), primary key | random UUID |
| `period` | varchar(7) | `YYYY-MM` |
| `payload` | text | the exact bytes signed and sent (text, not a JSON type, so nothing re-orders them) |
| `status` | varchar(16) | `pending`, `sent`, `rejected` or `failed` |
| `httpStatus` | integer | the HTTP status of the answer, if any |
| `attempts` | integer | the attempt number |
| `lastError` | varchar(255) | a machine-readable reason (status, problem code, field path; never a value) |
| `sentAt`, `createdAt` | bigint | epoch milliseconds |

The plugin keeps the last 12 rows.

## `ever_stats_lease`

One row, `id = 'sender'`: `leasedBy` (varchar(64), a random id per API process), `leaseUntil` and `lastSentAt` (bigint, epoch milliseconds). A process takes it with a compare-and-set update for 15 minutes before sending.
