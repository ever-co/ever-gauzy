import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { MultiORMColumn, MultiORMEntity, SkipExport } from '@gauzy/core';

/**
 * The connection of this installation to Ever Platform: one row, `id = 'self'`.
 *
 * It holds no credential: the installation proves itself with its connect key (kept encrypted in
 * `ever_instance`), and the short-lived token it gets with that key lives in memory only. The
 * instance-wide entitlement document is stored encrypted (`instanceEntitlementJwsEncrypted`).
 *
 * Times are epoch milliseconds. The table is created by the core `EverConnect` migration; the row
 * never leaves the installation (excluded from export archives).
 */
@SkipExport()
@MultiORMEntity('ever_connect_connection')
export class EverConnectConnection {
	// Both ORMs get the primary key whichever one is active (Gauzy initializes both).
	@PrimaryKey({ type: 'varchar', length: 16 })
	@PrimaryColumn({ type: 'varchar', length: 16 })
	id: string;

	/** The Registry id Ever Platform gave this installation (a ULID); never the statistics id. */
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	platformInstanceId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	kid?: string | null;

	/** The Ever organization that connected the installation (the connection owner). */
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	ownerOrgId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	ownerHandle?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	apiUrl?: string | null;

	/** Set only after the `instance_url` integration was consented and accepted. */
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	publicUrl?: string | null;

	/** `connected`, `pending_approval`, `revoked` or `disconnected`. */
	@MultiORMColumn({ type: 'varchar', length: 24 })
	status: string;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	connectedAt?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	connectedByUserId?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	lastHeartbeatAt?: number | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	nextHeartbeatAt?: number | null;

	/** The API process that runs the heartbeat and the event feed (when several share the database). */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	leasedBy?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	leaseUntil?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	feedCursor?: string | null;

	/** SHA-256 of the `EVER_CONNECT_CODE` value already used (it is never used twice). */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	envCodeConsumedHash?: string | null;

	@MultiORMColumn({ type: 'integer', default: 0 })
	envCodeAttempts: number;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	envCodeNextAttemptAt?: number | null;

	/** A machine-readable reason (a problem code); never a value, an address or a token. */
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	lastError?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	revokedAt?: number | null;

	@MultiORMColumn({ type: 'text', nullable: true, hidden: true })
	instanceEntitlementJwsEncrypted?: string | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	instanceEntitlementSeq?: number | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	instanceEntitlementIat?: number | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	instanceEntitlementExp?: number | null;

	@MultiORMColumn({ type: 'bigint', nullable: true })
	instanceEntitlementFetchedAt?: number | null;

	@MultiORMColumn({ type: 'bigint' })
	createdAt: number;

	@MultiORMColumn({ type: 'bigint' })
	updatedAt: number;
}
