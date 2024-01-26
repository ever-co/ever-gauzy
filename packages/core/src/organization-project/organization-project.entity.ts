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
import { isMySQL } from '@gauzy/config';

@Entity('organization_project')
export class OrganizationProject extends TenantOrganizationBaseEntity implements IOrganizationProject {

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
		nullable: true,
		default: OrganizationProjectBudgetTypeEnum.COST,
		...(isMySQL() ?
			{ type: 'enum', enum: OrganizationProjectBudgetTypeEnum }
			: { type: 'text' }
		)
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
	 * OrganizationGithubRepository Relationship
	 */
	@ManyToOne(() => OrganizationGithubRepository, (it) => it.projects, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	repository?: IOrganizationGithubRepository;

	/**
	 * Repository ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationProject) => it.repository)
	@Index()
	@Column({ nullable: true })
	repositoryId?: IOrganizationGithubRepository['id'];

	/**
	 * Organization Contact Relationship
	 */
	@ManyToOne(() => OrganizationContact, (it) => it.projects, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	/**
	 * Organization Contact ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationProject) => it.organizationContact)
	@Index()
	@Column({ nullable: true })
	organizationContactId?: IOrganizationContact['id'];

	/**
	 * ImageAsset Relationship
	 */
	@ManyToOne(() => ImageAsset, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,
	})
	@JoinColumn()
	image?: IImageAsset;

	/**
	 * Image Asset ID
	 */
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

	/**
	 * Organization Tasks Relationship
	 */
	@OneToMany(() => Task, (it) => it.project)
	tasks?: ITask[];

	/**
	 * TimeLog Relationship
	 */
	@OneToMany(() => TimeLog, (it) => it.project)
	timeLogs?: ITimeLog[];

	/**
	 * Organization Invoice Items Relationship
	 */
	@OneToMany(() => InvoiceItem, (it) => it.project)
	invoiceItems?: IInvoiceItem[];

	/**
	 * Organization Sprints Relationship
	 */
	@OneToMany(() => OrganizationSprint, (it) => it.project)
	organizationSprints?: IOrganizationSprint[];

	/**
	 * Organization Payments Relationship
	 */
	@OneToMany(() => Payment, (it) => it.project)
	payments?: IPayment[];

	/**
	 * Expense Relationship
	 */
	@OneToMany(() => Expense, (it) => it.project)
	expenses?: IExpense[];

	/**
	 * Activity Relationship
	 */
	@OneToMany(() => Activity, (it) => it.project)
	activities?: IActivity[];

	/**
	 * Project Statuses
	 */
	@OneToMany(() => TaskStatus, (it) => it.project)
	statuses?: ITaskStatus[];

	/**
	 * Project Related Issue Type Relationship
	 */
	@OneToMany(() => TaskRelatedIssueTypes, (it) => it.project)
	relatedIssueTypes?: ITaskRelatedIssueType[];

	/**
	 * Project Priorities Relationship
	 */
	@OneToMany(() => TaskPriority, (it) => it.project)
	priorities?: ITaskPriority[];

	/**
	 * Project Sizes Relationship
	 */
	@OneToMany(() => TaskSize, (it) => it.project)
	sizes?: ITaskSize[];

	/**
	 * Project Versions Relationship
	 */
	@OneToMany(() => TaskVersion, (it) => it.project)
	versions?: ITaskVersion[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tags Relationship
	 */
	@ManyToMany(() => Tag, (it) => it.organizationProjects, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	@JoinTable({
		name: 'tag_organization_project',
	})
	tags: ITag[];

	/**
	 * Project Members Relationship
	 */
	@ManyToMany(() => Employee, (it) => it.projects, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	members?: IEmployee[];

	/**
	 * Organization Teams Relationship
	 */
	@ManyToMany(() => OrganizationTeam, (it) => it.projects, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	@JoinTable({
		name: 'organization_project_team'
	})
	teams?: IOrganizationTeam[];
}
