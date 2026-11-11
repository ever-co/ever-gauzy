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

/**
 * What a Asana task and its task last agreed on: the synced fields as Asana sent them the last time the task was
 * applied. The next apply compares the task and the task with it, so a field changed on one side follows that
 * side, and one changed on both is a conflict. One row per task of a connection.
 */
@MultiORMEntity('integration_asana_task_baseline', { mikroOrmRepository: () => MikroOrmAsanaTaskBaselineRepository })
export class AsanaTaskBaseline extends TenantOrganizationBaseEntity {
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((baseline: AsanaTaskBaseline) => baseline.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	/** The Asana task's gid. */
	@MultiORMColumn({ type: 'varchar', length: 64 })
	sourceId!: string;

	/** The task the task is (a plain id). */
	@MultiORMColumn({ type: 'varchar', length: 36 })
	taskId!: ID;

	/** The agreed values (JSON: `title`, `description`, `status`, `priority`, `dueDate`). */
	@MultiORMColumn({ type: 'text' })
	syncedFields!: string;
}

@Injectable()
export class MikroOrmAsanaTaskBaselineRepository extends MikroOrmBaseEntityRepository<AsanaTaskBaseline> {}

@Injectable()
export class TypeOrmAsanaTaskBaselineRepository extends Repository<AsanaTaskBaseline> {
	constructor(@InjectRepository(AsanaTaskBaseline) readonly repository: Repository<AsanaTaskBaseline>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
