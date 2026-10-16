import { ID } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import {
	MikroOrmEverWorksEntityLinkRepository,
	MikroOrmEverWorksInboundEventRepository,
	MikroOrmEverWorksOutboundChangeRepository,
	MikroOrmEverWorksSyncLogRepository
} from './ever-works-sync.repositories';

/** What a link pairs (plan 03 §C.1). */
export enum EverWorksLinkType {
	MEMBER = 'MEMBER',
	AGENT = 'AGENT',
	TEAM = 'TEAM',
	PROJECT_WORK = 'PROJECT_WORK',
	INITIATIVE_MISSION = 'INITIATIVE_MISSION',
	GOAL = 'GOAL',
	KEY_RESULT = 'KEY_RESULT',
	TASK = 'TASK',
	IDEA_TASK = 'IDEA_TASK',
	COMMENT = 'COMMENT',
	TASK_LINK = 'TASK_LINK',
	INBOX_ITEM = 'INBOX_ITEM',
	DOC_FOLDER = 'DOC_FOLDER',
	DOC = 'DOC'
}

export enum EverWorksLinkState {
	OK = 'ok',
	CONFLICT = 'conflict',
	ERROR = 'error',
	/** The Gauzy record is gone (hard delete); the orphan sweep pushes the delete policy. */
	ORPHANED = 'orphaned',
	/** No longer synced (e.g. the Ever Works record turned `private`); both records are kept. */
	UNLINKED = 'unlinked'
}

export enum EverWorksInboundStatus {
	PENDING = 'pending',
	APPLIED = 'applied',
	SKIPPED = 'skipped',
	/** Waits for something (an unmapped user, a handler not shipped yet); retried later. */
	DEFERRED = 'deferred',
	FAILED = 'failed',
	DEAD = 'dead'
}

export enum EverWorksOutboundStatus {
	PENDING = 'pending',
	PUSHED = 'pushed',
	SKIPPED = 'skipped',
	DEFERRED = 'deferred',
	FAILED = 'failed',
	DEAD = 'dead'
}

/**
 * The identity map (plan 03 §C.1): one Gauzy record ↔ one Ever Works record per mapping, with the
 * snapshot of the shared fields at the last sync (the base of the 3-way merge and of the "nothing
 * changed" loop guard). Unique on both sides per mapping and type.
 */
@MultiORMEntity('ever_works_entity_link', { mikroOrmRepository: () => MikroOrmEverWorksEntityLinkRepository })
export class EverWorksEntityLink extends TenantOrganizationBaseEntity {
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36 })
	integrationTenantId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	entityType!: EverWorksLinkType;

	@MultiORMColumn({ type: 'varchar', length: 36 })
	gauzyId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	ewId!: string;

	@MultiORMColumn({ type: 'integer', nullable: true })
	ewVersion?: number | null;

	@MultiORMColumn({ nullable: true })
	ewUpdatedAt?: Date;

	@MultiORMColumn({ nullable: true })
	gauzyUpdatedAt?: Date;

	/** JSON: the normalised shared fields at the last sync. */
	@MultiORMColumn({ type: 'text', nullable: true })
	snapshot?: string | null;

	/** JSON: Ever Works-only fields kept for display and for pushes that must not drop them. */
	@MultiORMColumn({ type: 'text', nullable: true })
	ewOnly?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	lastDirection?: 'inbound' | 'outbound' | null;

	@MultiORMColumn({ nullable: true })
	lastSyncedAt?: Date;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: EverWorksLinkState.OK })
	state!: EverWorksLinkState;

	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string | null;
}

/**
 * Ever Works events as received (webhook, change feed or initial sync), deduplicated on the event id
 * per connection and applied in `seq` order per aggregate (plan 03 §C.4).
 */
@MultiORMEntity('ever_works_inbound_event', { mikroOrmRepository: () => MikroOrmEverWorksInboundEventRepository })
export class EverWorksInboundEvent extends TenantOrganizationBaseEntity {
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36 })
	connectionId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	eventId!: string;

	/** The global feed position (compared as an integer). */
	@MultiORMColumn({ type: 'bigint' })
	seq!: string;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	type!: string;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	aggregateType!: string;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	aggregateId!: string;

	@MultiORMColumn({ type: 'integer', nullable: true })
	aggregateVersion?: number | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	ewOrganizationId?: string | null;

	/** The envelope as received (JSON). */
	@MultiORMColumn({ type: 'text' })
	payload!: string;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	receivedVia!: 'webhook' | 'feed' | 'initial';

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: EverWorksInboundStatus.PENDING })
	status!: EverWorksInboundStatus;

	@MultiORMColumn({ type: 'integer', default: 0 })
	attempts!: number;

	@MultiORMColumn({ nullable: true })
	availableAt?: Date;

	@MultiORMColumn({ type: 'text', nullable: true })
	error?: string | null;

	@MultiORMColumn({ nullable: true })
	appliedAt?: Date;
}

/**
 * A Gauzy change waiting to be pushed (plan 03 §C.2–C.3). Coalesced: one pending row per mapping, type
 * and record; a new trigger merges into it. Each row is a hint: the push recomputes the full state.
 */
@MultiORMEntity('ever_works_outbound_change', { mikroOrmRepository: () => MikroOrmEverWorksOutboundChangeRepository })
export class EverWorksOutboundChange extends TenantOrganizationBaseEntity {
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36 })
	integrationTenantId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	entityType!: EverWorksLinkType;

	@MultiORMColumn({ type: 'varchar', length: 36 })
	gauzyId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 8, default: 'upsert' })
	op!: 'upsert' | 'delete';

	/** JSON `string[]`: fields the trigger said changed (a hint only). */
	@MultiORMColumn({ type: 'text', nullable: true })
	changedFieldsHint?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	actorUserId?: ID | null;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: EverWorksOutboundStatus.PENDING })
	status!: EverWorksOutboundStatus;

	@MultiORMColumn({ type: 'integer', default: 0 })
	attempts!: number;

	@MultiORMColumn({ nullable: true })
	availableAt?: Date;

	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string | null;
}

/** What the sync did (plan 03 §C.1): kept 30 days; conflicts until resolved. */
@MultiORMEntity('ever_works_sync_log', { mikroOrmRepository: () => MikroOrmEverWorksSyncLogRepository })
export class EverWorksSyncLog extends TenantOrganizationBaseEntity {
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	integrationTenantId?: ID | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	connectionId?: ID | null;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	direction!: 'inbound' | 'outbound' | 'system';

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	entityType?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	gauzyId?: ID | null;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	ewId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	action!: string;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16 })
	status!: 'ok' | 'skipped' | 'conflict' | 'error';

	@MultiORMColumn({ type: 'text', nullable: true })
	message?: string | null;

	/** JSON details (both values of a conflict, an error code). */
	@MultiORMColumn({ type: 'text', nullable: true })
	details?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	resolvedByUserId?: ID | null;

	@MultiORMColumn({ nullable: true })
	resolvedAt?: Date;
}
