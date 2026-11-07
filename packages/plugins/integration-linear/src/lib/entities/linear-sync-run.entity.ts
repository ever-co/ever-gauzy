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
export enum LinearSyncRunKind {
	/** An admin's "Import now" (every issue, or the ones changed since the last run). */
	IMPORT = 'import',
	/** A webhook delivery applied to one issue. */
	WEBHOOK = 'webhook'
}

export enum LinearSyncRunStatus {
	RUNNING = 'running',
	DONE = 'done',
	FAILED = 'failed'
}

/** One import or webhook application of a mapping: when it ran, what it counted, and how it ended. */
@MultiORMEntity('integration_linear_sync_run', { mikroOrmRepository: () => MikroOrmLinearSyncRunRepository })
export class LinearSyncRun extends TenantOrganizationBaseEntity {
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((run: LinearSyncRun) => run.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	/** The mapping the run concerns (a plain id: a deleted mapping keeps its history). */
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	mappingId?: ID | null;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	kind!: LinearSyncRunKind;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: LinearSyncRunStatus.RUNNING })
	status!: LinearSyncRunStatus;

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
export class MikroOrmLinearSyncRunRepository extends MikroOrmBaseEntityRepository<LinearSyncRun> {}

@Injectable()
export class TypeOrmLinearSyncRunRepository extends Repository<LinearSyncRun> {
	constructor(@InjectRepository(LinearSyncRun) readonly repository: Repository<LinearSyncRun>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
