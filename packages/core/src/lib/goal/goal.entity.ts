import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsOptional, IsEnum, IsString, IsUUID } from 'class-validator';
import { IGoal, GoalLevelEnum, IKeyResult, IOrganizationTeam, IEmployee, ID, IOrganizationStrategicInitiative } from '@gauzy/contracts';
import {
	Employee,
	KeyResult,
	OrganizationStrategicInitiative,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmGoalRepository } from './repository/mikro-orm-goal.repository';

@MultiORMEntity('goal', { mikroOrmRepository: () => MikroOrmGoalRepository })
export class Goal extends TenantOrganizationBaseEntity implements IGoal {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	@IsOptional()
	description?: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	deadline: string;

	@ApiProperty({ type: () => String, enum: GoalLevelEnum })
	@IsEnum(GoalLevelEnum)
	@MultiORMColumn()
	level: string;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	ownerTeamId?: ID;

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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	ownerEmployeeId?: ID;

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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	leadId?: ID;

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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	alignedKeyResultId?: ID;

	/**
	 * Organization Strategic Initiative - Optional alignment to a strategic direction
	 * Provides strategic context to this Goal (OKR)
	 * Answers: "What strategic direction does this Goal support?"
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => OrganizationStrategicInitiative, (initiative) => initiative.goals, {
		/** Indicates if relation column value can be nullable or not */
		nullable: true,
		/** Database cascade action on delete */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationStrategicInitiative?: IOrganizationStrategicInitiative;

	/**
	 * Organization Strategic Initiative ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Goal) => it.organizationStrategicInitiative)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationStrategicInitiativeId?: ID;

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
