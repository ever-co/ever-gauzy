import {
	RelationId,
	JoinColumn
} from 'typeorm';
import {
	IKeyResult,
	KeyResultTypeEnum,
	KeyResultDeadlineEnum,
	IEmployee,
	IGoal,
	IOrganizationProject,
	ITask,
	IKPI
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import {
	Employee,
	Goal,
	GoalKPI,
	KeyResultUpdate,
	OrganizationProject,
	Task,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmKeyResultRepository } from './repository/mikro-orm-keyresult.repository';

@MultiORMEntity('key_result', { mikroOrmRepository: () => MikroOrmKeyResultRepository })
export class KeyResult extends TenantOrganizationBaseEntity
	implements IKeyResult {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	@IsOptional()
	description?: string;

	@ApiProperty({ type: () => String, enum: KeyResultTypeEnum })
	@IsEnum(KeyResultTypeEnum)
	@MultiORMColumn()
	type: string;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	targetValue?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	initialValue: number;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	unit?: string;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
	update: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
	progress: number;

	@ApiProperty({ type: () => String, enum: KeyResultDeadlineEnum })
	@IsEnum(KeyResultDeadlineEnum)
	@MultiORMColumn()
	deadline: string;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	hardDeadline?: Date;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	softDeadline?: Date;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	@IsOptional()
	status?: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	weight?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Owner Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee)
	@JoinColumn()
	owner: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: KeyResult) => it.owner)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	ownerId: string;

	/**
	 * Lead Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	@IsOptional()
	lead?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: KeyResult) => it.lead)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	leadId?: string;

	/**
	 * Organization Project
	 */
	@ApiProperty({ type: () => OrganizationProject })
	@MultiORMManyToOne(() => OrganizationProject, { nullable: true })
	@JoinColumn({ name: 'projectId' })
	@IsOptional()
	project?: IOrganizationProject;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: KeyResult) => it.project)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	readonly projectId?: string;

	/**
	 * Task
	 */
	@ApiProperty({ type: () => Task })
	@MultiORMManyToOne(() => Task, { nullable: true })
	@JoinColumn({ name: 'taskId' })
	@IsOptional()
	task?: ITask;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: KeyResult) => it.task)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	readonly taskId?: string;

	/**
	 * GoalKPI
	 */
	@ApiProperty({ type: () => GoalKPI })
	@MultiORMManyToOne(() => GoalKPI, { nullable: true })
	@JoinColumn({ name: 'kpiId' })
	@IsOptional()
	kpi?: IKPI;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: KeyResult) => it.kpi)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	readonly kpiId?: string;

	/**
	 * Goal
	 */
	@ApiProperty({ type: () => Goal })
	@MultiORMManyToOne(() => Goal, (goal) => goal.keyResults, {
		onDelete: 'CASCADE'
	})
	@JoinColumn({ name: 'goalId' })
	goal: IGoal;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: KeyResult) => it.goal)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	readonly goalId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => KeyResultUpdate })
	@MultiORMOneToMany(() => KeyResultUpdate, (keyResultUpdate) => keyResultUpdate.keyResult, {
		cascade: true
	})
	updates?: KeyResultUpdate[];
}
