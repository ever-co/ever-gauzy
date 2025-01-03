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

	@ApiProperty({ enum: ScreeningTaskStatusEnum })
	@IsNotEmpty()
	@IsEnum(ScreeningTaskStatusEnum)
	@ColumnIndex()
	@MultiORMColumn()
	status: ScreeningTaskStatusEnum;

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
	 * Task
	 */
	@MultiORMOneToOne(() => Task, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	task: ITask;

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
	 * Creator
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true
	})
	@JoinColumn()
	creator?: IUser;

	@RelationId((it: ScreeningTask) => it.creator)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	creatorId?: ID;
}
