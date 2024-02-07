import {
	Column,
	RelationId,
	JoinColumn,
	Index
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
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmKeyResultRepository } from './repository/mikro-orm-keyresult.repository';
import { MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('key_result', { mikroOrmRepository: () => MikroOrmKeyResultRepository })
export class KeyResult extends TenantOrganizationBaseEntity
	implements IKeyResult {

	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column()
	@IsOptional()
	description?: string;

	@ApiProperty({ type: () => String, enum: KeyResultTypeEnum })
	@IsEnum(KeyResultTypeEnum)
	@Column()
	type: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	@IsOptional()
	targetValue?: number;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	@IsOptional()
	initialValue: number;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	@IsOptional()
	unit?: string;

	@ApiProperty({ type: () => Number })
	@Column()
	update: number;

	@ApiProperty({ type: () => Number })
	@Column()
	progress: number;

	@ApiProperty({ type: () => String, enum: KeyResultDeadlineEnum })
	@IsEnum(KeyResultDeadlineEnum)
	@Column()
	deadline: string;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	@IsOptional()
	hardDeadline?: Date;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	@IsOptional()
	softDeadline?: Date;

	@ApiProperty({ type: () => String })
	@Column()
	@IsOptional()
	status?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
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
	@Index()
	@Column()
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
	@Index()
	@Column({ nullable: true })
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
	@Index()
	@Column({ nullable: true })
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
	@Index()
	@Column({ nullable: true })
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
	@Index()
	@Column({ nullable: true })
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
	@Index()
	@Column({ nullable: true })
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
