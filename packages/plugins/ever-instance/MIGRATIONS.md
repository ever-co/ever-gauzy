# Migrations of @gauzy/plugin-ever-instance

Plugins cannot carry their own migrations yet, so `ever_instance` is created by `packages/core/src/lib/database/migrations/1790000021000-EverInstance.ts`. Move it here once plugins can own migrations.

The migration is hand-written for Postgres, MySQL and SQLite, uses `CREATE TABLE IF NOT EXISTS` (running `up` twice is harmless), creates one new empty table (no foreign key, no change to an existing table, no statement per tenant or per row), and takes a transaction-scoped advisory lock on Postgres so two API processes booting together run it one after the other. `down` drops the table.

## `ever_instance`

| Column | Type |
|---|---|
| `id` | varchar(16), primary key (`'self'`) |
| `instanceId` | varchar(36) |
| `statsPublicKey` | varchar(64) |
| `statsPrivateKeyEncrypted` | text |
| `statsKeyId` | varchar(16) |
| `operatorUserId` | varchar(36), nullable |
| `statsEnabledUi` | boolean, default true |
| `resetCount` | integer, default 0 |
| `connectPublicKey` | varchar(64), nullable |
| `connectPrivateKeyEncrypted` | text, nullable |
| `connectKeyId` | varchar(16), nullable |
| `jwksCache` | text, nullable |
| `jwksFetchedAt` | bigint, nullable (epoch milliseconds) |
| `createdAt`, `updatedAt` | bigint (epoch milliseconds) |
