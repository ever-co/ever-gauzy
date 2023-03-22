import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	ManyToMany,
	OneToMany,
	RelationId,
	JoinTable,
} from 'typeorm';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import {
	CurrenciesEnum,
	IActivity,
	IEmployee,
	IExpense,
	IImageAsset,
	IInvoiceItem,
	IOrganizationContact,
	IOrganizationProject,
	IOrganizationSprint,
	IPayment,
	ITag,
	ITask,
	ITaskPriority,
	ITaskSize,
	ITaskStatus,
	ITimeLog,
	OrganizationProjectBudgetTypeEnum,
	ProjectBillingEnum,
	ProjectOwnerEnum,
	TaskListTypeEnum,
} from '@gauzy/contracts';
import {
	Activity,
	Employee,
	Expense,
	ImageAsset,
	InvoiceItem,
	OrganizationContact,
	OrganizationSprint,
	Payment,
	Tag,
	Task,
	TaskPriority,
	TaskSize,
	TaskStatus,
	TenantOrganizationBaseEntity,
	TimeLog,
} from '../core/entities/internal';

@Entity('organization_project')
export class OrganizationProject extends TenantOrganizationBaseEntity
	implements IOrganizationProject {

	@Index()
	@Column()
	name: string;

	@Column({ nullable: true })
	startDate?: Date;

	@Column({ nullable: true })
	endDate?: Date;

	@Column({ nullable: true })
	billing: ProjectBillingEnum;

	@Index()
	@Column({ nullable: true })
	currency: CurrenciesEnum;

	@Column({ nullable: true })
	public: boolean;

	@Column({ nullable: true })
	owner: ProjectOwnerEnum;

	@Column({ default: TaskListTypeEnum.GRID })
	taskListType: TaskListTypeEnum;

	@Column({ nullable: true })
	code?: string;

	@Column({ nullable: true })
	description?: string;

	@Column({ nullable: true })
	color?: string;

	@Column({ nullable: true })
	billable?: boolean;

	@Column({ nullable: true })
	billingFlat?: boolean;

	@Column({ nullable: true })
	openSource?: boolean;

	@Column({ nullable: true })
	projectUrl?: string;

	@Column({ nullable: true })
	openSourceProjectUrl?: string;

	@Column({ nullable: true })
	budget?: number;

	@Column({
		type: 'text',
		nullable: true,
		default: OrganizationProjectBudgetTypeEnum.COST,
	})
	budgetType?: OrganizationProjectBudgetTypeEnum;

	@Column({ nullable: true, default: 0 })
	membersCount?: number;

	@Column({ length: 500, nullable: true })
	imageUrl?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Contact
	 */
	@ManyToOne(() => OrganizationContact, (it) => it.projects, {
		nullable: true,
		onUpdate: 'CASCADE',
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@RelationId((it: OrganizationProject) => it.organizationContact)
	@Index()
	@Column({ nullable: true })
	organizationContactId?: IOrganizationContact['id'];

	/**
	 * ImageAsset
	 */
	@ManyToOne(() => ImageAsset, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	image?: IImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationProject) => it.image)
	@Index()
	@Column({ nullable: true })
	imageId?: IImageAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	// Organization Tasks
	@OneToMany(() => Task, (it) => it.project, {
		onDelete: 'SET NULL',
	})
	tasks?: ITask[];

	// Organization TimeLogs
	@OneToMany(() => TimeLog, (it) => it.project)
	timeLogs?: ITimeLog[];

	// Organization Invoice Items
	@OneToMany(() => InvoiceItem, (it) => it.project, {
		onDelete: 'SET NULL',
	})
	invoiceItems?: IInvoiceItem[];

	// Organization Sprints
	@OneToMany(() => OrganizationSprint, (it) => it.project, {
		onDelete: 'SET NULL',
	})
	organizationSprints?: IOrganizationSprint[];

	// Organization Payments
	@OneToMany(() => Payment, (it) => it.project, {
		onDelete: 'SET NULL',
	})
	payments?: IPayment[];

	/**
	 * Expense
	 */
	@OneToMany(() => Expense, (it) => it.project, {
		onDelete: 'SET NULL',
	})
	expenses?: IExpense[];

	/**
	 * Activity
	 */
	@OneToMany(() => Activity, (activity) => activity.project)
	activities?: IActivity[];

	/**
	 * Project Statuses
	 */
	@OneToMany(() => TaskStatus, (status) => status.project)
	statuses?: ITaskStatus[];

	/**
	 * Project Priorities
	 */
	@OneToMany(() => TaskPriority, (priority) => priority.project)
	priorities?: ITaskPriority[];

	/**
	 * Project Sizes
	 */
	@OneToMany(() => TaskSize, (size) => size.project)
	sizes?: ITaskSize[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	// Organization Project Tags
	@ManyToMany(() => Tag, (tag) => tag.organizationProjects, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	@JoinTable({
		name: 'tag_organization_project',
	})
	tags: ITag[];

	// Organization Project Employees
	@ManyToMany(() => Employee, (employee) => employee.projects, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	members?: IEmployee[];
}
