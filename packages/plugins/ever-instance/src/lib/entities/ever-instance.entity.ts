import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * The identity of this installation: one row, `id = 'self'`, shared by every API process that uses
 * the same database (replicas, or an API and a second deployment on one database, count as one
 * installation).
 *
 * - `instanceId`: a random UUID made at first boot; the id of the anonymous statistics reports.
 * - `statsPublicKey` / `statsPrivateKeyEncrypted` / `statsKeyId`: the Ed25519 key that signs those
 *   reports and nothing else. The private key is stored encrypted (see `ever-instance-key.ts`).
 * - `operatorUserId`: on an installation with one tenant and no `EVER_OPERATOR_EMAILS`, the user who
 *   operates the installation (its first super admin), pinned once.
 * - `statsEnabledUi`: the operator's switch for the anonymous statistics (default on).
 * - `connect*`, `jwks*`: reserved for the Ever Platform connection, which keeps its own, separate key.
 *
 * Times are epoch milliseconds. The table is created by the core `EverInstance` migration. The row
 * never leaves the installation: it is excluded from export archives.
 */
@SkipExport()
@MultiORMEntity('ever_instance')
export class EverInstance {
	// Both ORMs get the primary key whichever one is active, as Gauzy's base entity does: Gauzy
	// initializes both and each one refuses an entity without a primary key.
	@PrimaryKey({ type: 'varchar', length: 16 })
	@PrimaryColumn({ type: 'varchar', length: 16 })
	id: string;

	@MultiORMColumn({ type: 'varchar', length: 36 })
	instanceId: string;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	statsPublicKey: string;

	@MultiORMColumn({ type: 'text', hidden: true })
	statsPrivateKeyEncrypted: string;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	statsKeyId: string;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	operatorUserId?: string | null;

	@MultiORMColumn({ type: Boolean, default: true })
	statsEnabledUi: boolean;

	@MultiORMColumn({ type: 'integer', default: 0 })
	resetCount: number;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	connectPublicKey?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true, hidden: true })
	connectPrivateKeyEncrypted?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	connectKeyId?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	jwksCache?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	jwksFetchedAt?: number | null;

	@MultiORMColumn({ type: 'bigint' })
	createdAt: number;

	@MultiORMColumn({ type: 'bigint' })
	updatedAt: number;
}
