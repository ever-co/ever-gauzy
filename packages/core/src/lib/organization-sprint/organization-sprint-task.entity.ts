import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ID, IOrganizationSprintTask, ITask } from '@gauzy/contracts';
import { OrganizationSprint, Task, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmOrganizationSprintTaskRepository } from './repository/mikro-orm-organization-sprint-task.repository';

@MultiORMEntity('organization_sprint_task', {
	mikroOrmRepository: () => MikroOrmOrganizationSprintTaskRepository
})
export class OrganizationSprintTask extends TenantOrganizationBaseEntity implements IOrganizationSprintTask {
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	totalWorkedHours?: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationSprint
	 */
	@MultiORMManyToOne(() => OrganizationSprint, (it) => it.taskSprints, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationSprint!: OrganizationSprint;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationSprintTask) => it.organizationSprint)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	organizationSprintId: ID;

	/**
	 * Task
	 */
	@MultiORMManyToOne(() => Task, (it) => it.taskSprints, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	task!: ITask;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationSprintTask) => it.task)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	taskId: ID;
}
