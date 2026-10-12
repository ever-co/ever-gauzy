# Migrations of @gauzy/plugin-ever-connect

Plugins cannot carry their own migrations yet, so the tables of this plugin are created by a migration in `packages/core/src/lib/database/migrations/`. Move it here once plugins can own migrations.

| Migration                       | Creates                                                                                                                                                                | Notes                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `1790000021000-EverInstance.ts` | `ever_instance`                                                                                                                                                        | Owned by `@gauzy/plugin-ever-instance`; the connection key lives in its `connect*` columns. |
| `1790000021200-EverConnect.ts`  | `ever_connect_connection`, `ever_connect_link`, `ever_connect_integration`, `ever_connect_policy`, `ever_connect_audit`, `ever_connect_lookup_cache` and their indexes | This plugin.                                                                                |

It is hand-written for Postgres, MySQL and SQLite, uses `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` (MySQL: the indexes are part of the table), so running `up` twice is harmless, creates new empty tables only (no foreign key, no change to an existing table, no statement per tenant or per row), and takes a transaction-scoped advisory lock on Postgres so two API processes booting together run it one after the other. `down` drops the six tables. It runs whether or not the plugin is loaded; the tables stay empty when it is not.

Values are checked by the plugin, not by `CHECK` constraints, so a later state needs no table rebuild. Times are epoch milliseconds (`bigint`).

## `ever_connect_connection` (one row, `id = 'self'`)

`platformInstanceId` (the Registry id, a ULID), `kid`, `ownerOrgId`, `ownerHandle`, `apiUrl`, `publicUrl`, `status` (`connected`, `pending_approval`, `revoked`, `disconnected`), `connectedAt`, `connectedByUserId`, `lastHeartbeatAt`, `nextHeartbeatAt`, `leasedBy` / `leaseUntil` (the API process that runs the heartbeat and the feed), `feedCursor`, `envCodeConsumedHash` / `envCodeAttempts` / `envCodeNextAttemptAt` (`EVER_CONNECT_CODE`), `lastError` (a code, never a value), `revokedAt`, `instanceEntitlementJwsEncrypted` (AES-256-GCM) and its `Seq`, `Iat`, `Exp`, `FetchedAt`, `createdAt`, `updatedAt`. No credential column.

## `ever_connect_link`

One row per Gauzy organization linked to an Ever organization: `tenantId`, `organizationId`, `integrationTenantId` (Gauzy's `integration_tenant` record of the link), `linkId` (unique), `everOrgId`, `everHandle`, `status` (`linked`, `suspended`, `orphaned`, `unlinked`), `entitlementJwsEncrypted` and its `Seq`, `Iat`, `Exp`, `FetchedAt`, `linkedByUserId`, `createdAt`, `updatedAt`, `unlinkedAt`, `liveKey` (`<tenantId>|<organizationId>` while the link is live, NULL once unlinked; unique, so one Gauzy organization has at most one live link, also under concurrent requests). Index on (`tenantId`, `organizationId`). There is no foreign key to the core tables: the rows of a deleted Gauzy tenant or organization are removed by the plugin (see the README, "What is stored").

## `ever_connect_integration`

The local state of an integration, installation-wide (`scope = 'instance'`) or per link (`scope` = the link id); unique on (`scope`, `name`): `tenantId`, `organizationId`, `integrationTenantId`, `scopeVersion`, `enabled`, `state` (`available`, `enabled`, `disabled`, `denied_by_policy`, `revoked_remote`, `coming_soon`, `pending_operator`), `operatorAccept`, `consentId`, `consentedAt`, `consentedByLabel`, `consentSource`, `termsVersion`, `dpaVersion`, `revokedAt`, `revokeSource` (`instance`, `platform`, `env`, `policy`, `operator`), `pendingRemoteRevoke`, `configEncrypted`, `createdAt`, `updatedAt`.

## `ever_connect_policy`

`integration` (primary key), `allowed`, `source` (`ui`, `default`), `changedByUserId`, `changedAt`.

## `ever_connect_audit`

Append-only: `at`, `tenantId` / `organizationId` (empty for an action on the installation), `actorUserId`, `actorLabel`, `action`, `integration`, `details` (JSON of ids and states only). Indexes on (`tenantId`, `organizationId`, `at`) and (`at`).

## `ever_connect_lookup_cache`

Reserved for the counterparty check (not available in this release; the table stays empty): `tenantId`, `organizationId`, `kind`, `hash`, `saltVersion`, `result`, `expiresAt`; unique on (`organizationId`, `kind`, `hash`).
