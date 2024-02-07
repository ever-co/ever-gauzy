import { IGoal, GoalLevelEnum, IKeyResult, IOrganizationTeam, IEmployee } from '@gauzy/contracts';
import { Column, Index, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import {
	Employee,
	KeyResult,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmGoalRepository } from './repository/mikro-orm-goal.repository';
import { MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('goal', { mikroOrmRepository: () => MikroOrmGoalRepository })
export class Goal extends TenantOrganizationBaseEntity implements IGoal {

	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column()
	@IsOptional()
	description?: string;

	@ApiProperty({ type: () => String })
	@Column()
	deadline: string;

	@ApiProperty({ type: () => String, enum: GoalLevelEnum })
	@IsEnum(GoalLevelEnum)
	@Column()
	level: string;

	@ApiProperty({ type: () => Number })
	@Column()
	progress: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationTeam
	 */
	@ApiProperty({ type: () => OrganizationTeam })
	@MultiORMManyToOne(() => OrganizationTeam, (team) => team.goals, {
		onDelete: 'CASCADE'
	})
	ownerTeam?: IOrganizationTeam;

	@ApiProperty({ type: () => String })
	@RelationId((it: Goal) => it.ownerTeam)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	ownerTeamId?: string;

	/**
	 * Owner Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, (employee) => employee.goals, {
		onDelete: 'CASCADE'
	})
	ownerEmployee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: Goal) => it.ownerEmployee)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	ownerEmployeeId?: string;

	/**
	 * Lead Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, (employee) => employee.leads, {
		onDelete: 'CASCADE'
	})
	lead?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: Goal) => it.lead)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	leadId?: string;

	/**
	 * KeyResult
	 */
	@ApiProperty({ type: () => KeyResult })
	@MultiORMManyToOne(() => KeyResult, (keyResult) => keyResult.id)
	alignedKeyResult?: IKeyResult;

	@ApiProperty({ type: () => String })
	@RelationId((it: Goal) => it.alignedKeyResult)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	alignedKeyResultId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * KeyResult
	 */
	@ApiProperty({ type: () => KeyResult, isArray: true })
	@MultiORMOneToMany(() => KeyResult, (keyResult) => keyResult.goal, {
		cascade: true
	})
	keyResults?: IKeyResult[];
}
