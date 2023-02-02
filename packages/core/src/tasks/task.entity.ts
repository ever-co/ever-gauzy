import {
	Entity,
	Column,
	ManyToOne,
	JoinColumn,
	RelationId,
	OneToMany,
	ManyToMany,
	JoinTable,
	Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
	TaskStatusEnum,
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
	User,
} from '../core/entities/internal';

@Entity('task')
@Index('taskNumber', ['projectId', 'number'], { unique: true })
export class Task extends TenantOrganizationBaseEntity
	implements ITask {

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	number?: number;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	prefix?: string;

	@ApiProperty({ type: () => String })
	@Column()
	title: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	status?: TaskStatusEnum;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	estimate?: number;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	dueDate?: Date;

	taskNumber?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Organization Project
	 */
	@ApiProperty({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, (it) => it.tasks, {
		nullable: true,
		onDelete: 'CASCADE',
	})
	project?: IOrganizationProject;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Task) => it.project)
	@Index()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Creator
	 */
	@ApiProperty({ type: () => User })
	@ManyToOne(() => User, {
		nullable: true,
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	creator?: IUser;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Task) => it.creator)
	@Index()
	@Column({ nullable: true })
	creatorId?: IUser['id'];

	/**
	 * Organization Sprint
	 */
	@ApiProperty({ type: () => OrganizationSprint })
	@ManyToOne(() => OrganizationSprint, { onDelete: 'SET NULL' })
	@JoinColumn()
	organizationSprint?: IOrganizationSprint;

	@ApiProperty({ type: () => String, readOnly: true })
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
	@ManyToMany(() => Tag, (tag) => tag.tasks, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	@JoinTable({
		name: 'tag_task',
	})
	tags?: ITag[];

	/**
	 * Members
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToMany(() => Employee, (employee) => employee.tasks, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	@JoinTable({
		name: 'task_employee',
	})
	members?: IEmployee[];

	/**
	 * OrganizationTeam
	 */
	@ApiProperty({ type: () => OrganizationTeam })
	@ManyToMany(() => OrganizationTeam, (team) => team.tasks, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	@JoinTable({
		name: 'task_team',
	})
	teams?: IOrganizationTeam[];
}
