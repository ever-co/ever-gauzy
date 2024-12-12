import { JoinColumn, JoinTable, RelationId } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	IActivity,
	ID,
	IDailyPlan,
	IEmployee,
	IInvoiceItem,
	IOrganizationProject,
	IOrganizationProjectModule,
	IOrganizationSprint,
	IOrganizationSprintTaskHistory,
	IOrganizationTeam,
	ITag,
	ITask,
	ITaskPriority,
	ITaskSize,
	ITaskStatus,
	ITimeLog,
	IUser,
	TaskPriorityEnum,
	TaskSizeEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import {
	Activity,
	DailyPlan,
	Employee,
	InvoiceItem,
	OrganizationProject,
	OrganizationProjectModule,
	OrganizationSprint,
	OrganizationSprintTask,
	OrganizationSprintTaskHistory,
	OrganizationTeam,
	OrganizationTeamEmployee,
	Tag,
	TaskEstimation,
	TaskLinkedIssue,
	TaskPriority,
	TaskSize,
	TaskStatus,
	TenantOrganizationBaseEntity,
	TimeLog,
	User
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	VirtualMultiOrmColumn
} from './../core/decorators/entity';
import { MikroOrmTaskRepository } from './repository/mikro-orm-task.repository';

@MultiORMEntity('task', { mikroOrmRepository: () => MikroOrmTaskRepository })
@ColumnIndex('taskNumber', ['projectId', 'number'], { unique: true })
export class Task extends TenantOrganizationBaseEntity implements ITask {
	[EntityRepositoryType]?: MikroOrmTaskRepository;

	@MultiORMColumn({
		nullable: true,
		...(isMySQL() ? { type: 'bigint' } : {})
	})
	number?: number;

	@MultiORMColumn({ nullable: true })
	prefix?: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	title: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({
		nullable: true,
		...(isMySQL() ? { type: 'text' } : {})
	})
	description?: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	status?: TaskStatusEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	priority?: TaskPriorityEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	size?: TaskSizeEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	issueType?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	estimate?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	dueDate?: Date;

	/**
	 * task privacy should be boolean true/false
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: true })
	public?: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	startDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	resolvedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	version?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	isDraft?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	isScreeningTask?: boolean;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	taskNumber?: string;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	rootEpic?: ITask;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	// Define the parent-child relationship
	@ApiPropertyOptional({ type: () => Task })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => Task, (task) => task.children, {
		onDelete: 'SET NULL'
	})
	parent?: Task;

	// Define the parent-child relationship
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: ID;

	/**
	 * Organization Project
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.tasks, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;

	/**
	 * Creator
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator?: IUser;

	@RelationId((it: Task) => it.creator)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	creatorId?: ID;

	/**
	 * Organization Sprint
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => OrganizationSprint, { onDelete: 'SET NULL' })
	@JoinColumn()
	organizationSprint?: IOrganizationSprint;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.organizationSprint)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationSprintId?: ID;

	/**
	 * Task Status
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => TaskStatus, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	taskStatus?: ITaskStatus;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.taskStatus)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, type: 'varchar', relationId: true })
	taskStatusId?: ID;

	/**
	 * Task Size
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => TaskSize, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	taskSize?: ITaskSize;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.taskSize)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, type: 'varchar', relationId: true })
	taskSizeId?: ID;

	/**
	 * Task Priority
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => TaskPriority, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	taskPriority?: ITaskPriority;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.taskPriority)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, type: 'varchar', relationId: true })
	taskPriorityId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Team Employees
	 */
	@MultiORMOneToMany(() => OrganizationTeamEmployee, (it) => it.activeTask)
	organizationTeamEmployees?: OrganizationTeamEmployee[];

	/**
	 * Estimations
	 */
	@MultiORMOneToMany(() => TaskEstimation, (it) => it.task)
	estimations?: TaskEstimation[];

	/**
	 * Children Tasks
	 */
	@MultiORMOneToMany(() => Task, (task) => task.parent)
	children?: Task[];

	/**
	 * InvoiceItem
	 */
	@MultiORMOneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.task)
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	/**
	 * TimeLog
	 */
	@MultiORMOneToMany(() => TimeLog, (it) => it.task)
	@JoinColumn()
	timeLogs?: ITimeLog[];

	/**
	 * Activity
	 */
	@MultiORMOneToMany(() => Activity, (activity) => activity.task)
	@JoinColumn()
	activities?: IActivity[];

	/**
	 * Linked Task Issues
	 */
	@MultiORMOneToMany(() => TaskLinkedIssue, (it) => it.taskTo)
	@JoinColumn()
	linkedIssues?: TaskLinkedIssue[];

	/*
	 * Task Sprint
	 */
	@MultiORMOneToMany(() => OrganizationSprintTask, (it) => it.task, {
		cascade: true
	})
	taskSprints?: IOrganizationSprint[];

	/*
	 * Sprint Task Histories
	 */
	@MultiORMOneToMany(() => OrganizationSprintTaskHistory, (it) => it.task, {
		cascade: true
	})
	taskSprintHistories?: IOrganizationSprintTaskHistory[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Daily planned Tasks
	 */
	@MultiORMManyToMany(() => DailyPlan, (dailyPlan) => dailyPlan.tasks, {
		onDelete: 'CASCADE'
	})
	dailyPlans?: IDailyPlan[];

	/**
	 * Tags
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => Tag, (tag) => tag.tasks, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_task',
		joinColumn: 'taskId',
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({
		name: 'tag_task'
	})
	tags?: ITag[];

	/**
	 * Members
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => Employee, (employee) => employee.tasks, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'task_employee',
		joinColumn: 'taskId',
		inverseJoinColumn: 'employeeId'
	})
	@JoinTable({
		name: 'task_employee'
	})
	members?: IEmployee[];

	/**
	 * OrganizationTeam
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => OrganizationTeam, (team) => team.tasks, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'task_team',
		joinColumn: 'taskId',
		inverseJoinColumn: 'organizationTeamId'
	})
	@JoinTable({
		name: 'task_team'
	})
	teams?: IOrganizationTeam[];

	/**
	 * Project Module
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => OrganizationProjectModule, (module) => module.tasks, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'project_module_task',
		joinColumn: 'taskId',
		inverseJoinColumn: 'organizationProjectModuleId'
	})
	@JoinTable({ name: 'project_module_task' })
	modules?: IOrganizationProjectModule[];
}
