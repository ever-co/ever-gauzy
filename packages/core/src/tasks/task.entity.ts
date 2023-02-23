import { Entity, Column, ManyToOne, JoinColumn, RelationId, OneToMany, ManyToMany, JoinTable, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	IActivity,
	IEmployee,
	IInvoiceItem,
	IOrganizationProject,
	IOrganizationSprint,
	IOrganizationTeam,
	ITag,
	ITask,
	ITimeLog,
	IUser,
	TaskPriorityEnum,
	TaskSizeEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import {
	Activity,
	Employee,
	InvoiceItem,
	OrganizationProject,
	OrganizationSprint,
	OrganizationTeam,
	Tag,
	TenantOrganizationBaseEntity,
	TimeLog,
	User
} from '../core/entities/internal';

@Entity('task')
@Index('taskNumber', ['projectId', 'number'], { unique: true })
export class Task extends TenantOrganizationBaseEntity implements ITask {
	@Column({ nullable: true })
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
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column({ nullable: true })
	status?: TaskStatusEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	priority?: TaskPriorityEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	size?: TaskSizeEnum;

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

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Organization Project
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@ManyToOne(() => OrganizationProject, (it) => it.tasks, {
		nullable: true,
		onDelete: 'CASCADE'
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
	@ManyToOne(() => User, {
		nullable: true,
		onDelete: 'CASCADE'
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
	@ManyToOne(() => OrganizationSprint, { onDelete: 'SET NULL' })
	@JoinColumn()
	organizationSprint?: IOrganizationSprint;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Task) => it.organizationSprint)
	@Index()
	@Column({ nullable: true })
	organizationSprintId?: IOrganizationSprint['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * InvoiceItem
	 */
	@OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.task)
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	/**
	 * TimeLog
	 */
	@OneToMany(() => TimeLog, (timeLog) => timeLog.task)
	@JoinColumn()
	timeLogs?: ITimeLog[];

	/**
	 * Activity
	 */
	@OneToMany(() => Activity, (activity) => activity.task)
	@JoinColumn()
	activities?: IActivity[];

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
	@ManyToMany(() => Tag, (tag) => tag.tasks, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
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
	@ManyToMany(() => Employee, (employee) => employee.tasks, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
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
	@ManyToMany(() => OrganizationTeam, (team) => team.tasks, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'task_team'
	})
	teams?: IOrganizationTeam[];
}
