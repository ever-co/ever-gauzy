import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { DailyPlanStatusEnum, ID, IDailyPlan, IEmployee, IOrganizationTeam, ITask } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne
} from '../../core/decorators/entity';
import { Employee, OrganizationTeam, Task, TenantOrganizationBaseEntity } from '../../core/entities/internal';
import { MikroOrmDailyPlanRepository } from './repository/mikro-orm-daily-plan.repository';

/**
 * Creating a plan looks up the employee's plan for that day in that team, and removing a task from
 * upcoming plans reads the employee's plans from today on: `(employeeId, organizationTeamId, date)`
 * serves both. Created by `AddDailyPlanEmployeeTeamDateIndex1790000023000`.
 *
 * An employee has at most one live plan per team and UTC day of `date`, the plans without a team
 * forming a team of their own: the unique index `IDX_daily_plan_employee_team_day_unique` on (tenantId,
 * organizationId, employeeId, COALESCE(organizationTeamId, nil uuid), day of `date`, NULL once
 * soft-deleted), created by `AddDailyPlanEmployeeTeamDayUniqueIndex1790000026000`. It indexes
 * expressions, which the ORM decorators cannot declare, so only the migration creates it.
 */
@ColumnIndex('IDX_daily_plan_employee_team_date', ['employeeId', 'organizationTeamId', 'date'])
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
	employeeId?: ID;

	/**
	 * OrganizationTeam
	 */
	@MultiORMManyToOne(() => OrganizationTeam, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DailyPlan) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: ID;

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
