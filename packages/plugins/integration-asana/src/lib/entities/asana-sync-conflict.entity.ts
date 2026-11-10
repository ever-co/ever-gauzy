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

export enum AsanaSyncConflictStatus {
	/** Waits for a manager. */
	OPEN = 'open',
	RESOLVED = 'resolved'
}

/** How a conflict ended. */
export enum AsanaSyncConflictResolution {
	/** The task's value, applied when the conflict was found, stays. */
	KEPT_EXTERNAL = 'kept_external',
	/** The task's value was written back (and sent to the task when the mapping sends changes out). */
	KEPT_PLATFORM = 'kept_platform',
	/** A later conflict on the same task and field replaced it. */
	SUPERSEDED = 'superseded'
}

/**
 * A task field changed both in Asana and on the platform to different values since they last agreed: Asana's value
 * was applied (it wins for the fields it syncs) and the task's is kept here, for a manager to accept or restore.
 * Found by an inbound apply (an import, a webhook, the scheduled sync); listed with the runs.
 */
@MultiORMEntity('integration_asana_sync_conflict', { mikroOrmRepository: () => MikroOrmAsanaSyncConflictRepository })
export class AsanaSyncConflict extends TenantOrganizationBaseEntity {
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((conflict: AsanaSyncConflict) => conflict.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	/** The mapping the task came through (a plain id: a removed mapping keeps its history). */
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

	/** The Asana task's gid. */
	@MultiORMColumn({ type: 'varchar', length: 64 })
	sourceId!: string;

	/** `title`, `description`, `status`, `priority` or `dueDate`. */
	@MultiORMColumn({ type: 'varchar', length: 32 })
	field!: string;

	/** The value both sides last agreed on. */
	@MultiORMColumn({ type: 'text', nullable: true })
	syncedValue?: string | null;

	/** The task's value, replaced by Asana's. */
	@MultiORMColumn({ type: 'text', nullable: true })
	platformValue?: string | null;

	/** Asana's value, applied to the task. */
	@MultiORMColumn({ type: 'text', nullable: true })
	externalValue?: string | null;

	/** The task's own columns of the field as they were (JSON), written back when the task's value is restored. */
	@MultiORMColumn({ type: 'text', nullable: true })
	platformPatch?: string | null;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: AsanaSyncConflictStatus.OPEN })
	status!: AsanaSyncConflictStatus;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	resolution?: AsanaSyncConflictResolution | null;

	// `Date | null` reflects as `Object` under strictNullChecks (the plugin's lib build), which TypeORM refuses: the type is said.
	@MultiORMColumn({ type: Date, nullable: true })
	resolvedAt?: Date | null;

	@MultiORMColumn({ type: 'varchar', length: 36, nullable: true })
	resolvedByUserId?: ID | null;
}

@Injectable()
export class MikroOrmAsanaSyncConflictRepository extends MikroOrmBaseEntityRepository<AsanaSyncConflict> {}

@Injectable()
export class TypeOrmAsanaSyncConflictRepository extends Repository<AsanaSyncConflict> {
	constructor(@InjectRepository(AsanaSyncConflict) readonly repository: Repository<AsanaSyncConflict>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
