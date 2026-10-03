# @gauzy/plugin-ever-instance: the identity of an installation

A small library shared by the Ever Platform modules of Ever Gauzy (such as `@gauzy/plugin-ever-stats`). It has no route, no timer and makes no outbound request; a test (`no-outbound.spec.ts`) checks that its sources contain no HTTP client.

## What it holds

One row in `ever_instance` (`id = 'self'`), shared by every API process that uses the same database:

| Column | Meaning |
|---|---|
| `instanceId` | A random UUID made at first start. It identifies the anonymous usage statistics of this installation and nothing else. |
| `statsPublicKey`, `statsPrivateKeyEncrypted`, `statsKeyId` | The Ed25519 key that signs the anonymous usage statistics reports, and only them. The private key is stored encrypted. |
| `operatorUserId` | On an installation with one tenant and no operator list: the user who operates it (its first super admin), remembered once, and replaced when that user can no longer be the operator. |
| `statsEnabledUi` | The operator's switch for the anonymous usage statistics (default on). |
| `resetCount` | How many times the identity was reset. |
| `connectPublicKey`, `connectPrivateKeyEncrypted`, `connectKeyId`, `jwksCache`, `jwksFetchedAt` | Reserved for an Ever Platform connection, which uses its own, separate key. Never written by the statistics. |
| `createdAt`, `updatedAt` | Epoch milliseconds. |

`ensure()` is safe when several processes start at once: each tries an insert that does nothing when the row exists, then reads the row, so all of them use the same id and key. The row is excluded from export archives.

## The key at rest

The private key is encrypted with AES-256-GCM. The encryption key is derived (HKDF-SHA256) from:

1. `ENCRYPTION_KEY`, when it is set (recommended);
2. otherwise `JWT_SECRET`;
3. otherwise a fixed value from this public source code: with `DEMO=true` (the demo compose file included), `ALLOW_INSECURE_JWT_SECRET=true` or in development. Any other production start refuses to run without `JWT_SECRET`. Whoever can read the database of such an installation can sign its anonymous reports, and nothing else.

The stored value records which one was used. When a stronger one is set later (`JWT_SECRET` over the fixed value, `ENCRYPTION_KEY` over both), the key is stored again under it at the next start. If the secret it was stored with changes, the key cannot be read: nothing is signed (and nothing sent), the settings page says so, until the operator uses *Reset instance identity*. The settings page warns, from how the key is actually stored, while it is not protected by `ENCRYPTION_KEY`. The private key is never logged, never returned by a route and never exported; a signer overwrites its copy once a report is sent.

## The operator

`EverOperatorService.isOperator(user, role)`: a super admin, as the database holds the user now (not deleted, active, not archived), who is:

- listed in `EVER_OPERATOR_USER_IDS` (Gauzy user ids, comma separated); or
- listed in `EVER_OPERATOR_EMAILS` (comma separated, case-insensitive). Gauzy addresses are neither unique nor proven at registration, so an address names one account only: the first account ever created with it (deleted ones included), and only once that account has confirmed the address. Anyone who registers the same address later, in a tenant of their own, is not the operator; or
- when neither list is set and the installation has exactly one tenant, its first super admin, pinned in `operatorUserId`. A pinned user who is deleted, deactivated, archived or no longer a super admin is replaced by the next super admin (compare and set, one audit line with both user ids).

With more than one tenant and no list, nobody. With `EVER_INSTALL_SOURCE=cloud`, nobody.

`EVER_INSTALL_SOURCE` is read as declared (`self-hosted` by default; `cloud`, `desktop`, `ever.sh`, `works_app`, `partner:<slug>` with the id of a published partner template), never guessed. An unknown value means `self-hosted` and logs one warning.

## Reset instance identity

Makes a new `instanceId` and a new statistics key, and increases `resetCount`. The connection columns are left as they are. Every toggle and reset emits an in-process event (`ever.instance.stats_toggle`, `ever.instance.reset`) and writes one structured log line with the actor's user id, never a secret or an address.

## Environment

| Variable | Use |
|---|---|
| `ENCRYPTION_KEY`, `JWT_SECRET` | Protect the stored key (read only). |
| `EVER_OPERATOR_USER_IDS` | The operators of the installation, by user id. |
| `EVER_OPERATOR_EMAILS` | The operators of the installation, by confirmed address (the first account with it). |
| `EVER_INSTALL_SOURCE` | How the installation is deployed. |
| `EVER_INSTANCE_ID` | Fixtures only: the id of a new identity (a UUID v4); ignored once an identity exists. |

Migrations: see `MIGRATIONS.md`.
