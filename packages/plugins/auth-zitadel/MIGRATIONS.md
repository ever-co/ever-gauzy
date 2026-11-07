<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# Migrations of @gauzy/plugin-auth-zitadel",
      "## Properties",
      "## Rollback"
    ]
  }
}
-->

# Migrations of @gauzy/plugin-auth-zitadel

Plugins cannot carry their own migrations yet, so the tables of this plugin
are created by a migration in core's migration folder. It moves into the
plugin unchanged once plugins can own migrations.

The migration is
`packages/core/src/lib/database/migrations/1790000018000-AuthZitadel.ts`.
It creates `zitadel_account`, `zitadel_organization`, `zitadel_session` and
`zitadel_logout_jti`.

Changes after it are the plugin's own migrations, registered by the plugin
(`AUTH_ZITADEL_MIGRATIONS` in `auth-zitadel.plugin.ts`), so they run where
the plugin is loaded (`ZITADEL_ENABLED=true`), after the core one:

- `src/lib/database/migrations/1791000006450-AddZitadelSessionRefreshToken.ts`
  adds the nullable `text` column `zitadel_session.everRefreshTokenEncrypted`
  (the App Launcher's encrypted Ever ID refresh token, see the README). Every
  row stays NULL until the launcher is on.

## Properties

- Creates new, empty tables and their indexes only. Reads and changes no
  existing table, and runs no statement per tenant or per row, so its run
  time does not depend on the size of the database.
- Every DDL statement is `IF NOT EXISTS`: running `up` twice is harmless.
- Postgres, MySQL and SQLite branches; `down` drops the four tables (and
  with them their indexes and constraints).
- Postgres: a transaction-scoped advisory lock makes two API processes that
  boot together against one database run it one after the other; the second
  finds everything in place. The foreign keys to `user`, `tenant` and
  `organization` take a brief lock on those tables; `lock_timeout` is 10 s,
  and a boot that times out simply retries on the next start.
- `zitadel_account` and `zitadel_session` reference `user` with
  `ON DELETE CASCADE`: deleting a Gauzy user deletes that user's Ever ID
  links and session records with it.
- The tables exist whether or not the plugin is enabled; they stay empty
  until it is.
- `AddZitadelSessionRefreshToken1791000006450` adds one nullable column
  without a default and has no data step: a catalog-only change on Postgres,
  no statement per tenant or per row anywhere. `ADD COLUMN IF NOT EXISTS` on
  Postgres and a column check on MySQL and SQLite make `up` safe to run twice;
  a transaction-scoped advisory lock (a named lock on MySQL) serialises two
  processes booting together.

## Rollback

The tables are additive and no core table is altered. Turning the plugin off
is enough; drop the tables only when they must go. `yarn migration:revert`
reverts the most recent migration, so run it only while
`AuthZitadel1790000018000` is the latest one.

The App Launcher column is inert while `EVER_APP_LAUNCHER_ENABLED` is off (the
daily pruning empties it). Reverting
`AddZitadelSessionRefreshToken1791000006450` drops it on Postgres and MySQL;
SQLite keeps the column, as it keeps every additive column, but clears its
values.
