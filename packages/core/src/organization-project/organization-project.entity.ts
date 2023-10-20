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
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	CurrenciesEnum,
	IActivity,
	IEmployee,
	IExpense,
	IImageAsset,
	IInvoiceItem,
	IOrganizationContact,
	IOrganizationGithubRepository,
	IOrganizationProject,
	IOrganizationSprint,
	IOrganizationTeam,
	IPayment,
	ITag,
	ITask,
	ITaskPriority,
	ITaskRelatedIssueType,
	ITaskSize,
	ITaskStatus,
	ITaskVersion,
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
	OrganizationGithubRepository,
	OrganizationSprint,
	OrganizationTeam,
	Payment,
	Tag,
	Task,
	TaskPriority,
	TaskRelatedIssueTypes,
	TaskSize,
	TaskStatus,
	TaskVersion,
	TenantOrganizationBaseEntity,
	TimeLog
} from '../core/entities/internal';

@Entity('organization_project')
export class OrganizationProject extends TenantOrganizationBaseEntity implements IOrganizationProject {
	deletedAt?: Date;

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

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Index()
	@Column({ default: true, nullable: true })
	isTasksAutoSync?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Index()
	@Column({ default: true, nullable: true })
	isTasksAutoSyncOnLabel?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	syncTag?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationGithubRepository
	 */
	@ManyToOne(() => OrganizationGithubRepository, (it) => it.projects, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	repository?: IOrganizationGithubRepository;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationProject) => it.repository)
	@Index()
	@Column({ nullable: true })
	repositoryId?: IOrganizationGithubRepository['id'];

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
		eager: true,
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
	 * Project Related Issue Type
	 */
	@OneToMany(
		() => TaskRelatedIssueTypes,
		(relatedIssueType) => relatedIssueType.organizationTeam
	)
	relatedIssueTypes?: ITaskRelatedIssueType[];

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

	/**
	 * Project Versions
	 */
	@OneToMany(() => TaskVersion, (version) => version.project)
	versions?: ITaskVersion[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tags
	 */
	@ManyToMany(() => Tag, (tag) => tag.organizationProjects, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	@JoinTable({
		name: 'tag_organization_project',
	})
	tags: ITag[];

	/**
	 * Project Members
	 */
	@ManyToMany(() => Employee, (employee) => employee.projects, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	members?: IEmployee[];

	/**
	 * Organization Teams
	 */
	@ManyToMany(() => OrganizationTeam, (it) => it.projects, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'organization_project_team'
	})
	teams?: IOrganizationTeam[];
}
