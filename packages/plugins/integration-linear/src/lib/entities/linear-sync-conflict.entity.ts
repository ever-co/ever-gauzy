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

export enum LinearSyncConflictStatus {
	/** Waits for a manager. */
	OPEN = 'open',
	RESOLVED = 'resolved'
}

/** How a conflict ended. */
export enum LinearSyncConflictResolution {
	/** The issue's value, applied when the conflict was found, stays. */
	KEPT_EXTERNAL = 'kept_external',
	/** The task's value was written back (and sent to the issue when the mapping sends changes out). */
	KEPT_PLATFORM = 'kept_platform',
	/** A later conflict on the same task and field replaced it. */
	SUPERSEDED = 'superseded'
}

/**
 * A task field changed both in Linear and on the platform to different values since they last agreed: Linear's value
 * was applied (it wins for the fields it syncs) and the task's is kept here, for a manager to accept or restore.
 * Found by an inbound apply (an import, a webhook, the scheduled sync); listed with the runs.
 */
@MultiORMEntity('integration_linear_sync_conflict', { mikroOrmRepository: () => MikroOrmLinearSyncConflictRepository })
export class LinearSyncConflict extends TenantOrganizationBaseEntity {
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((conflict: LinearSyncConflict) => conflict.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	/** The mapping the issue came through (a plain id: a removed mapping keeps its history). */
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	mappingId?: ID | null;

	/** The run that found it. */
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	runId?: ID | null;

	/** The task (a plain id: a deleted task keeps its history). */
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36 })
	taskId!: ID;

	/** The Linear issue's id. */
	@MultiORMColumn({ type: 'varchar', length: 64 })
	sourceId!: string;

	/** `title`, `description`, `status`, `priority` or `dueDate`. */
	@MultiORMColumn({ type: 'varchar', length: 32 })
	field!: string;

	/** The value both sides last agreed on. */
	@MultiORMColumn({ type: 'text', nullable: true })
	syncedValue?: string | null;

	/** The task's value, replaced by Linear's. */
	@MultiORMColumn({ type: 'text', nullable: true })
	platformValue?: string | null;

	/** Linear's value, applied to the task. */
	@MultiORMColumn({ type: 'text', nullable: true })
	externalValue?: string | null;

	/** The task's own columns of the field as they were (JSON), written back when the task's value is restored. */
	@MultiORMColumn({ type: 'text', nullable: true })
	platformPatch?: string | null;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: LinearSyncConflictStatus.OPEN })
	status!: LinearSyncConflictStatus;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	resolution?: LinearSyncConflictResolution | null;

	// `Date | null` reflects as `Object` under strictNullChecks (the plugin's lib build), which TypeORM refuses: the type is said.
	@MultiORMColumn({ type: Date, nullable: true })
	resolvedAt?: Date | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	resolvedByUserId?: ID | null;
}

@Injectable()
export class MikroOrmLinearSyncConflictRepository extends MikroOrmBaseEntityRepository<LinearSyncConflict> {}

@Injectable()
export class TypeOrmLinearSyncConflictRepository extends Repository<LinearSyncConflict> {
	constructor(@InjectRepository(LinearSyncConflict) readonly repository: Repository<LinearSyncConflict>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
