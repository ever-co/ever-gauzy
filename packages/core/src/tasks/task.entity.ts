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
	@ManyToOne(() => OrganizationProject, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
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
	// Invoice Items
	@ApiPropertyOptional({ type: () => InvoiceItem, isArray: true })
	@OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.task)
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	// Timelogs
	@OneToMany(() => TimeLog, (timeLog) => timeLog.task)
	timeLogs?: ITimeLog[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	// Tags
	@ApiProperty({ type: () => Tag })
	@ManyToMany(() => Tag, (tag) => tag.task)
	@JoinTable({ name: 'tag_task' })
	tags?: ITag[];

	// Members
	@ManyToMany(() => Employee, { cascade: ['update'] })
	@JoinTable({ name: 'task_employee' })
	readonly members?: IEmployee[];

	// Teams
	@ManyToMany(() => OrganizationTeam, { cascade: ['update'] })
	@JoinTable({ name: 'task_team' })
	teams?: IOrganizationTeam[];
}
