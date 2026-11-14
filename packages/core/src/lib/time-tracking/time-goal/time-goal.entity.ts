import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { EntityRepositoryType } from '@mikro-orm/core';
import {
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min
} from 'class-validator';
import {
	ID,
	IEmployee,
	IOrganizationContact,
	IOrganizationProject,
	IOrganizationTeam,
	ITimeGoal,
	TimeGoalComparisonEnum,
	TimeGoalPeriodEnum,
	TimeGoalScopeEnum
} from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne
} from '../../core/decorators/entity';
import {
	Employee,
	OrganizationContact,
	OrganizationProject,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '../../core/entities/internal';
import { ColumnNumericTransformerPipe } from '../../shared/pipes';
import { MikroOrmTimeGoalRepository } from './repository/mikro-orm-time-goal.repository';

/** The most hours a goal may ask for: a whole month of 31 days. */
export const TIME_GOAL_MAX_HOURS = 744;

/** The longest name a goal may have. */
export const TIME_GOAL_NAME_MAX_LENGTH = 255;

@MultiORMEntity('time_goal', { mikroOrmRepository: () => MikroOrmTimeGoalRepository })
export class TimeGoal extends TenantOrganizationBaseEntity implements ITimeGoal {
	[EntityRepositoryType]?: MikroOrmTimeGoalRepository;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(TIME_GOAL_NAME_MAX_LENGTH)
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String, enum: TimeGoalComparisonEnum })
	@IsEnum(TimeGoalComparisonEnum)
	@MultiORMColumn({ type: 'varchar' })
	comparison: TimeGoalComparisonEnum;

	@ApiProperty({ type: () => Number })
	@IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
	@Min(0.01)
	@Max(TIME_GOAL_MAX_HOURS)
	@MultiORMColumn({ type: 'numeric', precision: 7, scale: 2, transformer: new ColumnNumericTransformerPipe(2) })
	targetHours: number;

	@ApiProperty({ type: () => String, enum: TimeGoalPeriodEnum })
	@IsEnum(TimeGoalPeriodEnum)
	@MultiORMColumn({ type: 'varchar' })
	period: TimeGoalPeriodEnum;

	@ApiProperty({ type: () => String, enum: TimeGoalScopeEnum })
	@IsEnum(TimeGoalScopeEnum)
	@MultiORMColumn({ type: 'varchar' })
	scope: TimeGoalScopeEnum;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	billableOnly?: boolean;

	/**
	 * Whether the goal counts the projects it lists only. Kept apart from the list, so that a goal whose listed projects
	 * are all deleted counts nothing rather than every project.
	 */
	@ApiPropertyOptional({ type: () => Boolean, readOnly: true })
	@MultiORMColumn({ default: false })
	listedProjectsOnly?: boolean;

	/**
	 * Whether the goal counts the clients it lists only, for the same reason.
	 */
	@ApiPropertyOptional({ type: () => Boolean, readOnly: true })
	@MultiORMColumn({ default: false })
	listedClientsOnly?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The member a member goal counts. Empty for a team or organization goal.
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
	@RelationId((it: TimeGoal) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;

	/**
	 * The team whose members a team goal counts. Empty for a member or organization goal.
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
	@RelationId((it: TimeGoal) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * The projects whose time the goal counts. All projects when empty.
	 */
	@MultiORMManyToMany(() => OrganizationProject, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'time_goal_project',
		joinColumn: 'timeGoalId',
		inverseJoinColumn: 'organizationProjectId'
	})
	@JoinTable({ name: 'time_goal_project' })
	projects?: IOrganizationProject[];

	/**
	 * The clients whose time the goal counts. All clients when empty.
	 */
	@MultiORMManyToMany(() => OrganizationContact, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'time_goal_organization_contact',
		joinColumn: 'timeGoalId',
		inverseJoinColumn: 'organizationContactId'
	})
	@JoinTable({ name: 'time_goal_organization_contact' })
	organizationContacts?: IOrganizationContact[];
}
