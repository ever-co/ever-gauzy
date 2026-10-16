import { Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { ColumnIndex, MikroOrmBaseEntityRepository, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';

/** Why a run started. */
export type EverWorksSyncRunMode = 'initial' | 'resync';

/** Where a run stands. */
export enum EverWorksSyncRunStatus {
	RUNNING = 'running',
	DONE = 'done',
	FAILED = 'failed',
	CANCELLED = 'cancelled'
}

/**
 * One initial sync or resync of an organization mapping (plan 03 §C.6): its feed head, the state of each
 * phase (the checkpoint, JSON) and its outcome. The sync loop advances the running run of a mapping
 * under the connection's lease, so a run survives restarts and moves on in whichever process holds the
 * connection; at most one run per mapping is running.
 *
 * A table of its own rather than the mapping's `INITIAL_SYNC_STATE` setting: setting values are
 * `varchar(255)` on MySQL, too small for the phase checkpoints.
 */
@MultiORMEntity('ever_works_sync_run', { mikroOrmRepository: () => MikroOrmEverWorksSyncRunRepository })
export class EverWorksSyncRun extends TenantOrganizationBaseEntity {
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36 })
	integrationTenantId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 36 })
	connectionId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	mode!: EverWorksSyncRunMode;

	/** `admin` (started from the settings), `cursor_expired` (the feed answered 410). */
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	reason?: string | null;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: EverWorksSyncRunStatus.RUNNING })
	status!: EverWorksSyncRunStatus;

	/** The change-feed position when the run started (`whoami.feedHead`); replayed from at the end. */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	feedHead?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	currentPhase?: string | null;

	/** JSON `EverWorksSyncPhaseState[]`, in phase order. */
	@MultiORMColumn({ type: 'text', nullable: true })
	phases?: string | null;

	/** The admin who started it (null when the sync started it itself). */
	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	requestedByUserId?: ID | null;

	@MultiORMColumn({ nullable: true })
	startedAt?: Date;

	@MultiORMColumn({ nullable: true })
	finishedAt?: Date;

	@MultiORMColumn({ nullable: true })
	lastProgressAt?: Date;

	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string | null;
}

@Injectable()
export class MikroOrmEverWorksSyncRunRepository extends MikroOrmBaseEntityRepository<EverWorksSyncRun> {}
