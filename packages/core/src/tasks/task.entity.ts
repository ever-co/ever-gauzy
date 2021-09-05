import {
	Entity,
	Column,
	ManyToOne,
	JoinColumn,
	RelationId,
	OneToMany,
	ManyToMany,
	JoinTable,
	Index
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
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
export class Task extends TenantOrganizationBaseEntity implements ITask {
	
	@ApiProperty({ type: () => String })
	@Column()
	title: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String, enum: TaskStatusEnum })
	@Column()
	status?: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	@IsOptional()
	estimate?: number;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	@IsOptional()
	dueDate?: Date;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	// Organization Project
	@ApiProperty({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, (it) => it.tasks,  {
		nullable: true,
		onDelete: 'CASCADE'
	})
	project?: IOrganizationProject;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Task) => it.project)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly projectId?: string;

   	// Creator
	@ApiProperty({ type: () => User })
	@ManyToOne(() => User, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator?: IUser;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Task) => it.creator)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly creatorId?: string;

	// Organization Sprint
	@ApiProperty({ type: () => OrganizationSprint })
	@ManyToOne(() => OrganizationSprint, { onDelete: 'SET NULL' })
	@JoinColumn()
	organizationSprint?: IOrganizationSprint;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Task) => it.organizationSprint)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly organizationSprintId?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */
	/**
	 * InvoiceItem
	 */
	@ApiPropertyOptional({ type: () => InvoiceItem, isArray: true })
	@OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.task)
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	/**
	 * TimeLog
	 */
	@ApiPropertyOptional({ type: () => TimeLog, isArray: true })
	@OneToMany(() => TimeLog, (timeLog) => timeLog.task)
	@JoinColumn()
	timeLogs?: ITimeLog[];

	/**
	 * Activity
	 */
	@ApiPropertyOptional({ type: () => Activity, isArray: true })
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
	@ApiProperty({ type: () => Tag })
	@ManyToMany(() => Tag, (tag) => tag.task)
	tags?: ITag[];

	/**
	 * Members
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToMany(() => Employee, { cascade: ['update'] })
	@JoinTable({ name: 'task_employee' })
	members?: IEmployee[];

	/**
	 * OrganizationTeam
	 */
	@ApiProperty({ type: () => OrganizationTeam })
	@ManyToMany(() => OrganizationTeam, { cascade: ['update'] })
	@JoinTable({ name: 'task_team' })
	teams?: IOrganizationTeam[];
}
