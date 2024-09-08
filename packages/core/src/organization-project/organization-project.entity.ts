import { JoinColumn, RelationId, JoinTable } from 'typeorm';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
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
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@MultiORMColumn({ nullable: true })
	startDate?: Date;

	@MultiORMColumn({ nullable: true })
	endDate?: Date;

	@MultiORMColumn({ nullable: true })
	billing: ProjectBillingEnum;

	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	currency: CurrenciesEnum;

	@MultiORMColumn({ nullable: true })
	public: boolean;

	@MultiORMColumn({ nullable: true })
	owner: ProjectOwnerEnum;

	@MultiORMColumn({ default: TaskListTypeEnum.GRID })
	taskListType: TaskListTypeEnum;

	@MultiORMColumn({ nullable: true })
	code?: string;

	@MultiORMColumn({ nullable: true })
	description?: string;

	@MultiORMColumn({ nullable: true })
	color?: string;

	@MultiORMColumn({ nullable: true })
	billable?: boolean;

	@MultiORMColumn({ nullable: true })
	billingFlat?: boolean;

	@MultiORMColumn({ nullable: true })
	openSource?: boolean;

	@MultiORMColumn({ nullable: true })
	projectUrl?: string;

	@MultiORMColumn({ nullable: true })
	openSourceProjectUrl?: string;

	@MultiORMColumn({ nullable: true })
	budget?: number;

	@MultiORMColumn({
		nullable: true,
		default: OrganizationProjectBudgetTypeEnum.COST,
		...(isMySQL() ? { type: 'enum', enum: OrganizationProjectBudgetTypeEnum } : { type: 'text' })
	})
	budgetType?: OrganizationProjectBudgetTypeEnum;

	@MultiORMColumn({ nullable: true, default: 0 })
	membersCount?: number;

	@MultiORMColumn({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ default: true, nullable: true })
	isTasksAutoSync?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ default: true, nullable: true })
	isTasksAutoSyncOnLabel?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	syncTag?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEnum(TaskStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	status?: TaskStatusEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	icon?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'decimal' })
	archiveTasksIn?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'decimal' })
	closeTasksIn?: number;

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
	 * Project Manager
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => Employee, (it) => it.managedProjects, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	manager?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationProject) => it.manager)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	managerId?: ID;

	/**
	 * Project default member assignee
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => Employee, (it) => it.projectDefaultAssignments, {
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
	tags: ITag[];

	/**
	 * Project Members Relationship
	 */
	@MultiORMManyToMany(() => Employee, (it) => it.projects, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
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
