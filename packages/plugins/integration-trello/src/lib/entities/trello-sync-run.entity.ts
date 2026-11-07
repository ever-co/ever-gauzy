import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JoinColumn, RelationId, Repository } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import {
	ColumnIndex,
	IntegrationTenant,
	MikroOrmBaseEntityRepository,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';

/** Why a run started. */
export enum TrelloSyncRunKind {
	/** An admin's "Import now" (every issue, or the ones changed since the last run). */
	IMPORT = 'import',
	/** A webhook delivery applied to one issue. */
	WEBHOOK = 'webhook'
}

export enum TrelloSyncRunStatus {
	RUNNING = 'running',
	DONE = 'done',
	FAILED = 'failed'
}

/** One import or webhook application of a mapping: when it ran, what it counted, and how it ended. */
@MultiORMEntity('integration_trello_sync_run', { mikroOrmRepository: () => MikroOrmTrelloSyncRunRepository })
export class TrelloSyncRun extends TenantOrganizationBaseEntity {
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((run: TrelloSyncRun) => run.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	/** The mapping the run concerns (a plain id: a deleted mapping keeps its history). */
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	mappingId?: ID | null;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	kind!: TrelloSyncRunKind;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: TrelloSyncRunStatus.RUNNING })
	status!: TrelloSyncRunStatus;

	/** The admin who started it (null for a webhook). */
	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	requestedByUserId?: ID | null;

	@MultiORMColumn({ type: 'boolean', default: false })
	full!: boolean;

	// `Date | null` reflects as `Object` under strictNullChecks (the plugin's lib build), which TypeORM refuses: the type is said.
	@MultiORMColumn({ type: Date, nullable: true })
	startedAt?: Date | null;

	@MultiORMColumn({ type: Date, nullable: true })
	finishedAt?: Date | null;

	@MultiORMColumn({ type: 'integer', default: 0 })
	createdCount!: number;

	@MultiORMColumn({ type: 'integer', default: 0 })
	updatedCount!: number;

	@MultiORMColumn({ type: 'integer', default: 0 })
	skippedCount!: number;

	@MultiORMColumn({ type: 'integer', default: 0 })
	failedCount!: number;

	/** The watermark the run ended on. */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	cursor?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string | null;
}

@Injectable()
export class MikroOrmTrelloSyncRunRepository extends MikroOrmBaseEntityRepository<TrelloSyncRun> {}

@Injectable()
export class TypeOrmTrelloSyncRunRepository extends Repository<TrelloSyncRun> {
	constructor(@InjectRepository(TrelloSyncRun) readonly repository: Repository<TrelloSyncRun>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
