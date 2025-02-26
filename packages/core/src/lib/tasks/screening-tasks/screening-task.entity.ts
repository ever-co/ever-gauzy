import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, IScreeningTask, ITask, IUser, ScreeningTaskStatusEnum } from '@gauzy/contracts';
import { Task, TenantOrganizationBaseEntity, User } from '../../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToOne
} from '../../core/decorators/entity';
import { MikroOrmScreeningTaskRepository } from './repository/mikro-orm-screening-task.repository';

@MultiORMEntity('screening_task', { mikroOrmRepository: () => MikroOrmScreeningTaskRepository })
export class ScreeningTask extends TenantOrganizationBaseEntity implements IScreeningTask {
	[EntityRepositoryType]?: MikroOrmScreeningTaskRepository;

	/**
	 * Represents the current state or phase of the screening task.
	 */
	@ApiProperty({ enum: ScreeningTaskStatusEnum })
	@IsNotEmpty()
	@IsEnum(ScreeningTaskStatusEnum)
	@ColumnIndex()
	@MultiORMColumn()
	status: ScreeningTaskStatusEnum;

	/**
	 * Represents the date and time when the screening task is set to on hold.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	onHoldUntil?: Date;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The task associated with the screening task.
	 */
	@MultiORMOneToOne(() => Task, {
		cascade: true, // If set to true then it means that related object can be allowed to be inserted or updated in the database.
		onDelete: 'CASCADE', // Defines the database cascade action on delete.
		owner: true // This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.
	})
	@JoinColumn()
	task: ITask;

	/**
	 * The ID unique identifier of the associated task.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: ScreeningTask) => it.task)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	taskId: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The creator of the screening task.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true // Indicates if the relation column value can be nullable or not.
	})
	@JoinColumn()
	createdByUser?: IUser;

	/**
	 * The ID of the creator of the screening task.
	 */
	@RelationId((it: ScreeningTask) => it.createdByUser)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	createdByUserId?: ID;
}
