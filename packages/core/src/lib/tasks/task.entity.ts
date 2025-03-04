import { JoinColumn, JoinTable, RelationId } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	IActivity,
	ID,
	IDailyPlan,
	IEmployee,
	IInvoiceItem,
	IIssueType,
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
	TaskPriorityEnum,
	TaskSizeEnum,
	TaskStatusEnum,
	TaskTypeEnum
} from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import {
	Activity,
	DailyPlan,
	Employee,
	InvoiceItem,
	IssueType,
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
	TimeLog
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

	/**
	 * Represents the title of the task or entity.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	title: string;

	/**
	 * Represents a unique identifier or reference number associated with the task.
	 */
	@MultiORMColumn({
		nullable: true,
		...(isMySQL() ? { type: 'bigint' } : {})
	})
	number?: number;

	/**
	 * A prefix string associated with the task.
	 */
	@MultiORMColumn({ nullable: true })
	prefix?: string;

	/**
	 * A brief summary or explanation of the task.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({
		nullable: true,
		...(isMySQL() ? { type: 'text' } : {})
	})
	description?: string;

	/**
	 * The current status of the task.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	status?: TaskStatusEnum;

	/**
	 * Indicates the priority level of the task.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	priority?: TaskPriorityEnum;

	/**
	 * Specifies the size or complexity of the task.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	size?: TaskSizeEnum;

	/**
	 * Defines the type or category of the task.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	issueType?: TaskTypeEnum;

	/**
	 * Estimates the amount of time, in hours, required to complete the task.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	estimate?: number;

	/**
	 * The due date by which the task should be completed.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	dueDate?: Date;

	/**
	 * Indicates whether the task is public or private.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: true })
	public?: boolean;

	/**
	 * The date when work on the task is scheduled to begin.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	startDate?: Date;

	/**
	 * The date and time when the task was marked as resolved.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	resolvedAt?: Date;

	/**
	 * The version identifier associated with the task.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	version?: string;

	/**
	 * Indicates whether the task is in draft status.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	isDraft?: boolean;

	/**
	 * Specifies if the task is designated for screening purposes.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	isScreeningTask?: boolean;

	/**
	 * Additional virtual columns
	 */
	@VirtualMultiOrmColumn()
	taskNumber?: string;

	@VirtualMultiOrmColumn()
	rootEpic?: ITask;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The parent task to which this task is related.
	 */
	@ApiPropertyOptional({ type: () => Task })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => Task, (task) => task.children, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	parent?: Task;

	/**
	 * The ID unique identifier of the parent task.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.parent)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: ID;

	/**
	 * The project associated with this task.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.tasks, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	project?: IOrganizationProject;

	/**
	 * The ID unique identifier of the associated project.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;

	/**
	 * The sprint within the organization to which this task is assigned.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => OrganizationSprint, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationSprint?: IOrganizationSprint;

	/**
	 * The ID unique identifier of the associated sprint.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.organizationSprint)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationSprintId?: ID;

	/**
	 * The current status of the task.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => TaskStatus, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	taskStatus?: ITaskStatus;

	/**
	 * The ID unique identifier of the task's status.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.taskStatus)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	taskStatusId?: ID;

	/**
	 * The size classification of the task.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => TaskSize, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	taskSize?: ITaskSize;

	/**
	 * The ID unique identifier of the task's size classification.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.taskSize)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	taskSizeId?: ID;

	/**
	 * The priority level assigned to the task.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => TaskPriority, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	taskPriority?: ITaskPriority;

	/**
	 * The ID unique identifier of the task's priority level.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.taskPriority)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	taskPriorityId?: ID;

	/**
	 * The type of the task.
	 */
	@ApiPropertyOptional({ type: () => IssueType })
	@IsOptional()
	@Type(() => IssueType)
	@MultiORMManyToOne(() => IssueType, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	taskType?: IIssueType;

	/**
	 * The ID unique identifier of the task's type or category.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.taskType)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	taskTypeId?: ID;
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
	invoiceItems?: IInvoiceItem[];

	/**
	 * TimeLog
	 */
	@MultiORMOneToMany(() => TimeLog, (it) => it.task)
	timeLogs?: ITimeLog[];

	/**
	 * Activity
	 */
	@MultiORMOneToMany(() => Activity, (activity) => activity.task)
	activities?: IActivity[];

	/**
	 * Linked Task Issues
	 */
	@MultiORMOneToMany(() => TaskLinkedIssue, (it) => it.taskTo)
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
	 * Daily Planned Tasks
	 */
	@MultiORMManyToMany(() => DailyPlan, (dailyPlan) => dailyPlan.tasks, {
		onDelete: 'CASCADE' // Defines the database cascade action on delete.
	})
	dailyPlans?: IDailyPlan[];

	/**
	 * Task Tags
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
	@JoinTable({ name: 'tag_task' })
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
	@JoinTable({ name: 'task_employee' })
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
	@JoinTable({ name: 'task_team' })
	teams?: IOrganizationTeam[];

	/**
	 * Project Module
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => OrganizationProjectModule, (module) => module.tasks, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'project_module_task',
		joinColumn: 'taskId',
		inverseJoinColumn: 'organizationProjectModuleId'
	})
	@JoinTable({ name: 'project_module_task' })
	modules?: IOrganizationProjectModule[];
}
