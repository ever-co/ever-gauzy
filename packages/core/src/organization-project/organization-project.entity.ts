import {
	Column,
	Index,
	JoinColumn,
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
import { isMySQL } from '@gauzy/config';
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
	TaskRelatedIssueType,
	TaskSize,
	TaskStatus,
	TaskVersion,
	TenantOrganizationBaseEntity,
	TimeLog
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOrganizationProjectRepository } from './repository/mikro-orm-organization-project.repository';
import { MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('organization_project', { mikroOrmRepository: () => MikroOrmOrganizationProjectRepository })
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
	@MultiORMManyToOne(() => OrganizationGithubRepository, (it) => it.projects, {
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
	@MultiORMManyToOne(() => OrganizationContact, (it) => it.projects, {
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
	@MultiORMManyToOne(() => ImageAsset, {
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
	@MultiORMOneToMany(() => Task, (it) => it.project)
	tasks?: ITask[];

	/**
	 * TimeLog Relationship
	 */
	@MultiORMOneToMany(() => TimeLog, (it) => it.project)
	timeLogs?: ITimeLog[];

	/**
	 * Organization Invoice Items Relationship
	 */
	@MultiORMOneToMany(() => InvoiceItem, (it) => it.project)
	invoiceItems?: IInvoiceItem[];

	/**
	 * Organization Sprints Relationship
	 */
	@MultiORMOneToMany(() => OrganizationSprint, (it) => it.project)
	organizationSprints?: IOrganizationSprint[];

	/**
	 * Organization Payments Relationship
	 */
	@MultiORMOneToMany(() => Payment, (it) => it.project)
	payments?: IPayment[];

	/**
	 * Expense Relationship
	 */
	@MultiORMOneToMany(() => Expense, (it) => it.project)
	expenses?: IExpense[];

	/**
	 * Activity Relationship
	 */
	@MultiORMOneToMany(() => Activity, (it) => it.project)
	activities?: IActivity[];

	/**
	 * Project Statuses
	 */
	@MultiORMOneToMany(() => TaskStatus, (it) => it.project)
	statuses?: ITaskStatus[];

	/**
	 * Project Related Issue Type Relationship
	 */
	@MultiORMOneToMany(() => TaskRelatedIssueType, (it) => it.project)
	relatedIssueTypes?: ITaskRelatedIssueType[];

	/**
	 * Project Priorities Relationship
	 */
	@MultiORMOneToMany(() => TaskPriority, (it) => it.project)
	priorities?: ITaskPriority[];

	/**
	 * Project Sizes Relationship
	 */
	@MultiORMOneToMany(() => TaskSize, (it) => it.project)
	sizes?: ITaskSize[];

	/**
	 * Project Versions Relationship
	 */
	@MultiORMOneToMany(() => TaskVersion, (it) => it.project)
	versions?: ITaskVersion[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tags Relationship
	 */
	@MultiORMManyToMany(() => Tag, (it) => it.organizationProjects, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization_project',
	})
	@JoinTable({
		name: 'tag_organization_project',
	})
	tags: ITag[];

	/**
	 * Project Members Relationship
	 */
	@MultiORMManyToMany(() => Employee, (it) => it.projects, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	members?: IEmployee[];

	/**
	 * Organization Teams Relationship
	 */
	@MultiORMManyToMany(() => OrganizationTeam, (it) => it.projects, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'organization_project_team',
	})
	@JoinTable({
		name: 'organization_project_team'
	})
	teams?: IOrganizationTeam[];
}
