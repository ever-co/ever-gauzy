import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IOrganizationSprintTaskHistory, ITask, IUser } from '@gauzy/contracts';
import { OrganizationSprint, Task, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmOrganizationSprintTaskRepository } from './repository/mikro-orm-organization-sprint-task.repository';

@MultiORMEntity('organization_sprint_task_history', {
	mikroOrmRepository: () => MikroOrmOrganizationSprintTaskRepository
})
export class OrganizationSprintTaskHistory
	extends TenantOrganizationBaseEntity
	implements IOrganizationSprintTaskHistory
{
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'text', nullable: true })
	reason?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Task
	 */
	@MultiORMManyToOne(() => Task, (it) => it.taskSprintHistories, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	task!: ITask;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationSprintTaskHistory) => it.task)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	taskId: ID;

	/**
	 * From OrganizationSprint
	 */
	@MultiORMManyToOne(() => OrganizationSprint, (it) => it.fromSprintTaskHistories, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	fromSprint!: OrganizationSprint;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationSprintTaskHistory) => it.fromSprint)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	fromSprintId: ID;

	/**
	 * To OrganizationSprint
	 */
	@MultiORMManyToOne(() => OrganizationSprint, (it) => it.toSprintTaskHistories, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	toSprint!: OrganizationSprint;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationSprintTaskHistory) => it.toSprint)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	toSprintId: ID;

	/**
	 * User moved issue
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	movedBy?: IUser;

	@RelationId((it: OrganizationSprintTaskHistory) => it.movedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	movedById?: ID;
}
