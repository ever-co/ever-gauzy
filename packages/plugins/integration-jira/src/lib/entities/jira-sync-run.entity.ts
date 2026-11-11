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
export enum JiraSyncRunKind {
	/** An admin's "Import now" (every issue, or the ones changed since the last run). */
	IMPORT = 'import',
	/** A webhook delivery applied to one issue. */
	WEBHOOK = 'webhook'
}

export enum JiraSyncRunStatus {
	RUNNING = 'running',
	DONE = 'done',
	FAILED = 'failed'
}

/** One import or webhook application of a mapping: when it ran, what it counted, its report, and how it ended. */
@MultiORMEntity('integration_jira_sync_run', { mikroOrmRepository: () => MikroOrmJiraSyncRunRepository })
export class JiraSyncRun extends TenantOrganizationBaseEntity {
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((run: JiraSyncRun) => run.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	/** The mapping the run concerns (a plain id: a deleted mapping keeps its history). */
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	mappingId?: ID | null;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	kind!: JiraSyncRunKind;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: JiraSyncRunStatus.RUNNING })
	status!: JiraSyncRunStatus;

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

	/** The watermark the run ended on: where the next import starts (a run that stopped early continues from it). */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	cursor?: string | null;

	/**
	 * The run's report (JSON, `JiraSyncRunReport`): where it started and stopped, the pages read, the comments, links and
	 * conflicts it brought in, and the issues it could not apply (by key, with why) — written as it goes.
	 */
	@MultiORMColumn({ type: 'text', nullable: true })
	report?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string | null;
}

@Injectable()
export class MikroOrmJiraSyncRunRepository extends MikroOrmBaseEntityRepository<JiraSyncRun> {}

@Injectable()
export class TypeOrmJiraSyncRunRepository extends Repository<JiraSyncRun> {
	constructor(@InjectRepository(JiraSyncRun) readonly repository: Repository<JiraSyncRun>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
