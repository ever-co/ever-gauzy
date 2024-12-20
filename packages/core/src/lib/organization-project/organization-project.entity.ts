import { JoinColumn, RelationId, JoinTable } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	CurrenciesEnum,
	IActivity,
	ID,
	IEmployee,
	IExpense,
	IImageAsset,
	IInvoiceItem,
	IOrganizationContact,
	IOrganizationProject,
	IOrganizationProjectEmployee,
	IOrganizationProjectModule,
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
	ITaskView,
	ITimeLog,
	OrganizationProjectBudgetTypeEnum,
	ProjectBillingEnum,
	ProjectOwnerEnum,
	TaskListTypeEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import {
	Activity,
	Employee,
	Expense,
	ImageAsset,
	InvoiceItem,
	OrganizationContact,
	OrganizationProjectEmployee,
	OrganizationProjectModule,
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
	TaskView,
	TenantOrganizationBaseEntity,
	TimeLog
} from '../core/entities/internal';
import {
	ColumnIndex,
	EmbeddedColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { MikroOrmOrganizationProjectRepository } from './repository/mikro-orm-organization-project.repository';
import {
	MikroOrmOrganizationProjectEntityCustomFields,
	OrganizationProjectEntityCustomFields,
	TypeOrmOrganizationProjectEntityCustomFields
} from '../core/entities/custom-entity-fields/organization-project';
import { HasCustomFields } from '../core/entities/custom-entity-fields';
import { Taggable } from '../tags/tag.types';

@MultiORMEntity('organization_project', { mikroOrmRepository: () => MikroOrmOrganizationProjectRepository })
export class OrganizationProject
	extends TenantOrganizationBaseEntity
	implements IOrganizationProject, Taggable, HasCustomFields
{
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	startDate?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	endDate?: Date;

	@ApiPropertyOptional({ enum: ProjectBillingEnum, example: ProjectBillingEnum.FLAT_FEE })
	@IsOptional()
	@IsEnum(ProjectBillingEnum)
	@MultiORMColumn({ nullable: true })
	billing?: ProjectBillingEnum;

	@ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum, example: CurrenciesEnum.USD })
	@IsOptional()
	@IsEnum(CurrenciesEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	currency?: CurrenciesEnum;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	public?: boolean;

	@ApiPropertyOptional({ type: () => String, enum: ProjectOwnerEnum, example: ProjectOwnerEnum.CLIENT })
	@IsOptional()
	@IsEnum(ProjectOwnerEnum)
	@MultiORMColumn({ nullable: true })
	owner?: ProjectOwnerEnum;

	@ApiProperty({ type: () => String, enum: TaskListTypeEnum, example: TaskListTypeEnum.GRID })
	@IsEnum(TaskListTypeEnum)
	@MultiORMColumn({ default: TaskListTypeEnum.GRID })
	taskListType?: TaskListTypeEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	code?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	color?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	billable?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	billingFlat?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	openSource?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	projectUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	openSourceProjectUrl?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	budget?: number;

	// Specifies the type of budget for the project, if provided.
	@ApiPropertyOptional({ type: () => String, enum: OrganizationProjectBudgetTypeEnum })
	@IsOptional()
	@IsEnum(OrganizationProjectBudgetTypeEnum)
	@MultiORMColumn({
		nullable: true,
		default: OrganizationProjectBudgetTypeEnum.COST,
		...(isMySQL() ? { type: 'enum', enum: OrganizationProjectBudgetTypeEnum } : { type: 'text' })
	})
	budgetType?: OrganizationProjectBudgetTypeEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ length: 500, nullable: true })
	imageUrl?: string;

	// Specifies the icon of the project, if provided.
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	icon?: string;

	// Specifies the status of the project, if provided.
	@ApiPropertyOptional({ type: () => String, enum: TaskStatusEnum })
	@IsOptional()
	@IsEnum(TaskStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	status?: TaskStatusEnum;

	// Auto-sync tasks property
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ default: true, nullable: true })
	isTasksAutoSync?: boolean;

	// Auto-sync on label property
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ default: true, nullable: true })
	isTasksAutoSyncOnLabel?: boolean;

	// Auto-sync tasks label property
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	syncTag?: string;

	// Defines the number of days after which tasks will be archived automatically, if specified.
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, type: 'decimal' })
	archiveTasksIn?: number;

	// Specifies the number of days after which tasks will be automatically closed, if provided.
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, type: 'decimal' })
	closeTasksIn?: number;

	// Specifies the number of members in the project, if provided.
	@MultiORMColumn({ nullable: true, default: 0 })
	membersCount?: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationContactId?: ID;

	/**
	 * ImageAsset Relationship
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: ID;

	/**
	 * Project Default Assignee
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	defaultAssignee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationProject) => it.defaultAssignee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	defaultAssigneeId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationTeamEmployee
	 */
	@MultiORMOneToMany(() => OrganizationProjectEmployee, (it) => it.organizationProject, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true
	})
	members?: IOrganizationProjectEmployee[];

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

	/**
	 * Project views Relationship
	 */
	@MultiORMOneToMany(() => TaskView, (it) => it.project)
	views?: ITaskView[];

	/**
	 * Organization modules Relationship
	 */
	@MultiORMOneToMany(() => OrganizationProjectModule, (it) => it.project)
	modules?: IOrganizationProjectModule[];

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
		joinColumn: 'organizationProjectId',
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({
		name: 'tag_organization_project'
	})
	tags?: ITag[];

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
		joinColumn: 'organizationProjectId',
		inverseJoinColumn: 'organizationTeamId'
	})
	@JoinTable({
		name: 'organization_project_team'
	})
	teams?: IOrganizationTeam[];

	/*
	|--------------------------------------------------------------------------
	| Embeddable Columns
	|--------------------------------------------------------------------------
	*/
	@EmbeddedColumn({
		mikroOrmEmbeddableEntity: () => MikroOrmOrganizationProjectEntityCustomFields,
		typeOrmEmbeddableEntity: () => TypeOrmOrganizationProjectEntityCustomFields
	})
	customFields?: OrganizationProjectEntityCustomFields;
}
