import { Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { ColumnIndex, MikroOrmBaseEntityRepository, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';

/** The MikroORM repositories the entities name (the services themselves run on TypeORM's `DataSource`). */
@Injectable()
export class MikroOrmRealtimePresenceRepository extends MikroOrmBaseEntityRepository<RealtimePresence> {}

@Injectable()
export class MikroOrmRealtimeReplayWatermarkRepository extends MikroOrmBaseEntityRepository<RealtimeReplayWatermark> {}

/**
 * `realtime_presence`: what one connection of an employee last reported, and — under the reserved key
 * {@link REALTIME_PUBLISHED_PRESENCE_KEY} — the merged presence last published to the organization.
 *
 * Unique on (`tenantId`, `employeeId`, `connectionId`). A connection counts until `expiresAt`; a row without one never
 * lapses (the published row, and the one connection a client that names none shares).
 *
 * The unique key is declared here as well as in the migration: the presence lock relies on it (an insert of the
 * published row is ignored when the row exists), so a schema built from the entities (`DB_SYNCHRONIZE`) needs it too.
 *
 * The date column is typed `?: Date`, not `Date | null`: its column type comes from the design type, and a `| null`
 * union is emitted as `Object`, which TypeORM refuses at boot.
 */
@MultiORMEntity('realtime_presence', { mikroOrmRepository: () => MikroOrmRealtimePresenceRepository })
@ColumnIndex('UQ_realtime_presence_connection', ['tenantId', 'employeeId', 'connectionId'], { unique: true })
export class RealtimePresence extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	employeeId!: ID;

	@MultiORMColumn()
	userId!: ID;

	/** The client's own id for the connection (one per tab or device), or a reserved key. */
	@MultiORMColumn({ type: 'varchar', length: 64 })
	connectionId!: string;

	/** `active`, `idle` or `away` for a connection; any status, `offline` included, for the published row. */
	@MultiORMColumn({ type: 'varchar', length: 16 })
	status!: string;

	@MultiORMColumn({ nullable: true })
	expiresAt?: Date;

	/**
	 * On the published row: how many times the employee's merged presence changed. Written under the row's lock, so it
	 * orders the changes of one employee whichever process publishes them; a reader applies a change only when its
	 * revision is higher than the last one applied.
	 */
	@MultiORMColumn({ type: 'int', default: 0 })
	revision!: number;

	/**
	 * On the published row: when the organization was last told of the employee's presence, and which revision it was
	 * told. Written by a conditional update that admits one publication per {@link REALTIME_PRESENCE_COALESCE_MS}
	 * window across processes (`RealtimePresenceStore.claimPublication`).
	 */
	@MultiORMColumn({ nullable: true })
	publishedAt?: Date;

	@MultiORMColumn({ type: 'int', default: 0 })
	publishedRevision!: number;
}

/**
 * `realtime_replay_watermark`: the newest outbox position (`createdAt`, `eventId`) a retention removed from one scope
 * — an organization, or the tenant-wide rows (`scopeKey` {@link REALTIME_TENANT_WIDE_SCOPE}). A catch-up whose cursor
 * precedes it answers `resync`. Unique on (`tenantId`, `scopeKey`); it only ever moves forward.
 */
@MultiORMEntity('realtime_replay_watermark', { mikroOrmRepository: () => MikroOrmRealtimeReplayWatermarkRepository })
@ColumnIndex('UQ_realtime_replay_watermark_scope', ['tenantId', 'scopeKey'], { unique: true })
export class RealtimeReplayWatermark extends TenantOrganizationBaseEntity {
	/** The organization's id, or {@link REALTIME_TENANT_WIDE_SCOPE} for the tenant-wide rows. */
	@MultiORMColumn({ type: 'varchar', length: 64 })
	scopeKey!: string;

	/** The `createdAt` of the newest row removed. */
	@MultiORMColumn()
	prunedAt!: Date;

	/** The `eventId` of the newest row removed (the tie-break of rows stamped in the same millisecond). */
	@MultiORMColumn()
	prunedEventId!: ID;
}

/** The `connectionId` of the row holding an employee's published presence (never a client's id: the DTO refuses it). */
export const REALTIME_PUBLISHED_PRESENCE_KEY = '*';

/** The `connectionId` a client that names no connection reports under: all such tabs of an employee share it. */
export const REALTIME_SHARED_CONNECTION_KEY = '~';

/** The `scopeKey` of the tenant-wide rows' watermark. */
export const REALTIME_TENANT_WIDE_SCOPE = '*';

/** Every table the plugin owns (its migration creates them). */
export const REALTIME_ENTITIES = [RealtimePresence, RealtimeReplayWatermark];
