# @gauzy/plugin-ever-instance: the identity of an installation

A small library shared by the Ever Platform modules of Ever Gauzy (such as `@gauzy/plugin-ever-stats`). It has no route, no timer and makes no outbound request; a test (`no-outbound.spec.ts`) checks that its sources contain no HTTP client.

## What it holds

One row in `ever_instance` (`id = 'self'`), shared by every API process that uses the same database:

| Column | Meaning |
|---|---|
| `instanceId` | A random UUID made at first start. It identifies the anonymous usage statistics of this installation and nothing else. |
| `statsPublicKey`, `statsPrivateKeyEncrypted`, `statsKeyId` | The Ed25519 key that signs the anonymous usage statistics reports, and only them. The private key is stored encrypted. |
| `operatorUserId` | On an installation with one tenant and no `EVER_OPERATOR_EMAILS`: the user who operates it (its first super admin), remembered once. |
| `statsEnabledUi` | The operator's switch for the anonymous usage statistics (default on). |
| `resetCount` | How many times the identity was reset. |
| `connectPublicKey`, `connectPrivateKeyEncrypted`, `connectKeyId`, `jwksCache`, `jwksFetchedAt` | Reserved for an Ever Platform connection, which uses its own, separate key. Never written by the statistics. |
| `createdAt`, `updatedAt` | Epoch milliseconds. |

`ensure()` is safe when several processes start at once: each tries an insert that does nothing when the row exists, then reads the row, so all of them use the same id and key. The row is excluded from export archives.

## The key at rest

The private key is encrypted with AES-256-GCM. The encryption key is derived (HKDF-SHA256) from:

1. `ENCRYPTION_KEY`, when it is set (recommended);
2. otherwise `JWT_SECRET`;
3. otherwise a fixed value (development only; production refuses to start without `JWT_SECRET`).

The stored value records which one was used. When `ENCRYPTION_KEY` is set later, the key is stored again under it at the next start. If the secret it was stored with changes, the key cannot be read: nothing is signed (and nothing sent) until the operator uses *Reset instance identity*. The settings page warns while `ENCRYPTION_KEY` is not set. The private key is never logged, never returned by a route and never exported.

## The operator

`EverOperatorService.isOperator(user, role)`: a super admin who is listed in `EVER_OPERATOR_EMAILS` (comma separated, case-insensitive), or, when that is unset and the installation has exactly one tenant, its first super admin. With more than one tenant and no list, nobody. With `EVER_INSTALL_SOURCE=cloud`, nobody.

`EVER_INSTALL_SOURCE` is read as declared (`self-hosted` by default; `cloud`, `desktop`, `ever.sh`, `works_app`, `partner:<slug>`), never guessed. An unknown value means `self-hosted` and logs one warning.

## Reset instance identity

Makes a new `instanceId` and a new statistics key, and increases `resetCount`. The connection columns are left as they are. Every toggle and reset emits an in-process event (`ever.instance.stats_toggle`, `ever.instance.reset`) and writes one structured log line with the actor's user id, never a secret or an address.

## Environment

| Variable | Use |
|---|---|
| `ENCRYPTION_KEY`, `JWT_SECRET` | Protect the stored key (read only). |
| `EVER_OPERATOR_EMAILS` | The operators of the installation. |
| `EVER_INSTALL_SOURCE` | How the installation is deployed. |
| `EVER_INSTANCE_ID` | Fixtures only: the id of a new identity (a UUID v4); ignored once an identity exists. |

Migrations: see `MIGRATIONS.md`.
