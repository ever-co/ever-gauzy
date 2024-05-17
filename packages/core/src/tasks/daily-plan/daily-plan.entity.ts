import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { EntityRepositoryType } from '@mikro-orm/knex';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { DailyPlanStatusEnum, IDailyPlan, IEmployee, ITask } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne
} from '../../core/decorators/entity';
import { Employee, Task, TenantOrganizationBaseEntity } from '../../core/entities/internal';
import { MikroOrmDailyPlanRepository } from './repository';

@MultiORMEntity('daily_plan', { mikroOrmRepository: () => MikroOrmDailyPlanRepository })
export class DailyPlan extends TenantOrganizationBaseEntity implements IDailyPlan {
	[EntityRepositoryType]?: MikroOrmDailyPlanRepository;

	@ApiProperty({ type: () => Date })
	@Type(() => Date)
	@IsNotEmpty()
	@IsDate()
	@MultiORMColumn()
	date: Date;

	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'decimal' })
	workTimePlanned: number;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	status: DailyPlanStatusEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Employee
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DailyPlan) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: IEmployee['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Daily Planned Tasks
	 */
	@MultiORMManyToMany(() => Task, (dailyPlan) => dailyPlan.dailyPlans, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		pivotTable: 'daily_plan_task',
		owner: true,
		joinColumn: 'taskId',
		inverseJoinColumn: 'dailyPlanId'
	})
	@JoinTable({ name: 'daily_plan_task' })
	tasks?: ITask[];
}
