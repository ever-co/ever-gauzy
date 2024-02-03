import {
	Column,
	Index,
	JoinColumn,
	JoinTable,
	RelationId,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
} from 'class-validator';
import {
	IActivity,
	IEmployee,
	IInvoiceItem,
	IOrganizationProject,
	IOrganizationSprint,
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
	TaskStatusEnum,
} from '@gauzy/contracts';
import { isMySQL } from "@gauzy/config";
import {
	Activity,
	Employee,
	InvoiceItem,
	OrganizationProject,
	OrganizationSprint,
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
	User,
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmTaskRepository } from './repository/mikro-orm-task.repository';
import { MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('task', { mikroOrmRepository: () => MikroOrmTaskRepository })
@Index('taskNumber', ['projectId', 'number'], { unique: true })
export class Task extends TenantOrganizationBaseEntity implements ITask {
	@Column({
		nullable: true,
		...(isMySQL() ? { type: 'bigint' } : {})
	})
	number?: number;

	@Column({ nullable: true })
	prefix?: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column()
	title: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({
		nullable: true,
		...(isMySQL() ? { type: 'text' } : {})
	})
	description?: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Index()
	@Column({ nullable: true })
	status?: TaskStatusEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	priority?: TaskPriorityEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	size?: TaskSizeEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	issueType?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Column({ nullable: true })
	estimate?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	dueDate?: Date;

	/**
	 * task privacy should be boolean true/false
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ nullable: true, default: true })
	public?: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Column({ nullable: true })
	startDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Column({ nullable: true })
	resolvedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	version?: string;

	/**
	 * Additional exposed fields
	 */
	taskNumber?: string;
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
		onDelete: 'SET NULL',
	})
	parent?: Task;

	// Define the parent-child relationship
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@Column({ nullable: true })
	parentId?: Task['id'];

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
		onDelete: 'CASCADE',
	})
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.project)
	@Index()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Creator
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	creator?: IUser;

	@RelationId((it: Task) => it.creator)
	@Index()
	@Column({ nullable: true })
	creatorId?: IUser['id'];

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
	@Index()
	@Column({ nullable: true })
	organizationSprintId?: IOrganizationSprint['id'];

	/**
	 * Task Status
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => TaskStatus, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	taskStatus?: ITaskStatus;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.taskStatus)
	@Index()
	@Column({ nullable: true, type: 'varchar' })
	taskStatusId?: ITaskStatus['id'];

	/**
	 * Task Size
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => TaskSize, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	taskSize?: ITaskSize;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.taskSize)
	@Index()
	@Column({ nullable: true, type: 'varchar' })
	taskSizeId?: ITaskSize['id'];

	/**
	 * Task Priority
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => TaskPriority, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	taskPriority?: ITaskPriority;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.taskPriority)
	@Index()
	@Column({ nullable: true, type: 'varchar' })
	taskPriorityId?: ITaskPriority['id'];

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
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

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
		pivotTable: 'tag_task'
	})
	@JoinTable({
		name: 'tag_task',
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
		pivotTable: 'task_employee'
	})
	@JoinTable({
		name: 'task_employee',
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
		pivotTable: 'task_team'
	})
	@JoinTable({
		name: 'task_team',
	})
	teams?: IOrganizationTeam[];
}
