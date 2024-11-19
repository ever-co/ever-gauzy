import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import {
	CurrenciesEnum,
	IEmployee,
	PayPeriodEnum,
	IContact,
	ISkill,
	IUser,
	IOrganizationPosition,
	IOrganizationTeam,
	ITimeLog,
	IOrganizationDepartment,
	IOrganizationEmploymentType,
	IInvoiceItem,
	IRequestApprovalEmployee,
	IOrganizationProject,
	IOrganizationContact,
	IEmployeeSetting,
	ITimeOffPolicy,
	ITimeOff as ITimeOffRequest,
	IExpense,
	ITimesheet,
	ITask,
	ITimeSlot,
	IGoal,
	ICandidate,
	IEmployeeAward,
	IEquipmentSharing,
	IEmployeePhone,
	IDailyPlan,
	IOrganizationProjectModule,
	ID,
	IFavorite,
	IComment,
	IOrganizationSprint
} from '@gauzy/contracts';
import {
	ColumnIndex,
	EmbeddedColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	MultiORMOneToOne,
	VirtualMultiOrmColumn
} from '../core/decorators/entity';
import {
	Candidate,
	Comment,
	Contact,
	DailyPlan,
	EmployeeAward,
	EmployeePhone,
	EmployeeSetting,
	EquipmentSharing,
	Expense,
	Favorite,
	Goal,
	InvoiceItem,
	OrganizationContact,
	OrganizationDepartment,
	OrganizationEmploymentType,
	OrganizationPosition,
	OrganizationProjectEmployee,
	OrganizationProjectModule,
	OrganizationSprintEmployee,
	OrganizationTeamEmployee,
	RequestApprovalEmployee,
	Skill,
	Tag,
	Task,
	TaskEstimation,
	TenantOrganizationBaseEntity,
	TimeLog,
	TimeOffPolicy,
	TimeOffRequest,
	Timesheet,
	TimeSlot,
	User
} from '../core/entities/internal';
import { HasCustomFields } from '../core/entities/custom-entity-fields';
import {
	EmployeeEntityCustomFields,
	MikroOrmEmployeeEntityCustomFields,
	TypeOrmEmployeeEntityCustomFields
} from '../core/entities/custom-entity-fields/employee';
import { Trimmed } from '../shared/decorators';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { Taggable } from '../tags/tag.types';
import { MikroOrmEmployeeRepository } from './repository/mikro-orm-employee.repository';

@MultiORMEntity('employee', { mikroOrmRepository: () => MikroOrmEmployeeRepository })
export class Employee extends TenantOrganizationBaseEntity implements IEmployee, Taggable, HasCustomFields {
	[EntityRepositoryType]?: MikroOrmEmployeeRepository;

	@MultiORMColumn({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 200 })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	@MultiORMColumn({ length: 200, nullable: true })
	short_description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	startedWorkOn?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	endWork?: Date;

	@ApiPropertyOptional({ type: () => String, enum: PayPeriodEnum, example: PayPeriodEnum.WEEKLY })
	@IsOptional()
	@IsEnum(PayPeriodEnum)
	@MultiORMColumn({ nullable: true })
	payPeriod?: PayPeriodEnum;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Transform((params: TransformFnParams) => parseInt(params.value || 0, 10))
	@MultiORMColumn({ nullable: true })
	billRateValue?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Transform((params: TransformFnParams) => parseInt(params.value || 0, 10))
	@MultiORMColumn({ nullable: true })
	minimumBillingRate?: number;

	@ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum, example: CurrenciesEnum.USD })
	@IsOptional()
	@IsEnum(CurrenciesEnum)
	@MultiORMColumn({ nullable: true })
	billRateCurrency?: CurrenciesEnum;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Transform((params: TransformFnParams) => parseInt(params.value || 0, 10))
	@MultiORMColumn({ nullable: true })
	reWeeklyLimit?: number; // Recurring Weekly Limit (hours)

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	offerDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	acceptDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	rejectDate?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@MultiORMColumn({ length: 500, nullable: true })
	employeeLevel?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	anonymousBonus?: boolean;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true, type: 'numeric', transformer: new ColumnNumericTransformerPipe() })
	averageIncome?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true, type: 'numeric', transformer: new ColumnNumericTransformerPipe() })
	averageBonus?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true, type: 'numeric', default: 0, transformer: new ColumnNumericTransformerPipe() })
	totalWorkHours?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ type: 'numeric', nullable: true, transformer: new ColumnNumericTransformerPipe() })
	averageExpenses?: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	show_anonymous_bonus?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	show_average_bonus?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	show_average_expenses?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	show_average_income?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	show_billrate?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	show_payperiod?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	show_start_work_on?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	isJobSearchActive?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Trimmed()
	@IsUrl()
	@MultiORMColumn({ nullable: true })
	linkedInUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Trimmed()
	@IsUrl()
	@MultiORMColumn({ nullable: true })
	facebookUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Trimmed()
	@IsUrl()
	@MultiORMColumn({ nullable: true })
	instagramUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Trimmed()
	@IsUrl()
	@MultiORMColumn({ nullable: true })
	twitterUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Trimmed()
	@IsUrl()
	@MultiORMColumn({ nullable: true })
	githubUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Trimmed()
	@IsUrl()
	@MultiORMColumn({ nullable: true })
	gitlabUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Trimmed()
	@IsUrl()
	@MultiORMColumn({ nullable: true })
	upworkUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Trimmed()
	@IsUrl()
	@MultiORMColumn({ nullable: true })
	stackoverflowUrl?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	isVerified?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	isVetted?: boolean;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ type: 'numeric', nullable: true, transformer: new ColumnNumericTransformerPipe() })
	totalJobs?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ type: 'numeric', nullable: true, transformer: new ColumnNumericTransformerPipe() })
	jobSuccess?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ length: 100, nullable: true })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	profile_link?: string;

	/**
	 * Enabled/Disabled Time Tracking Feature
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true, default: false })
	isTrackingEnabled: boolean;

	/** Employee status (Online/Offline) */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true, default: false })
	isOnline?: boolean;

	@ApiPropertyOptional({ type: () => String, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true, default: false })
	isAway?: boolean;

	/** Employee time tracking status */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true, default: false })
	isTrackingTime?: boolean;

	/**
	 * Enabled/Disabled Screen Capture Feature
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	allowScreenshotCapture?: boolean;

	/**
	 * Indicates whether manual time entry is allowed for time tracking
	 * for a specific employee.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	allowManualTime?: boolean;

	/**
	 * Indicates whether modification of time entries is allowed for time tracking
	 * for a specific employee.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	allowModifyTime?: boolean;

	/**
	 * Indicates whether deletion of time entries is allowed for time tracking
	 * for a specific employee.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	allowDeleteTime?: boolean;

	/** Upwork ID */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	upworkId?: string;

	/** LinkedIn ID */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	linkedInId?: string;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	fullName?: string;

	@VirtualMultiOrmColumn()
	isDeleted?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * User
	 */
	@MultiORMOneToOne(() => User, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	user: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Employee) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	userId: ID;

	/**
	 * Contact
	 */
	@MultiORMOneToOne(() => Contact, (contact) => contact.employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	contact?: IContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Employee) => it.contact)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	contactId?: ID;

	/**
	 * Candidate
	 */
	@MultiORMOneToOne(() => Candidate, (candidate) => candidate.employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** This column is a boolean flag indicating that this is the inverse side of the relationship, and it doesn't control the foreign key directly  */
		owner: false
	})
	candidate?: ICandidate;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	// Employee Organization Position
	@MultiORMManyToOne(() => OrganizationPosition, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true
	})
	@JoinColumn()
	organizationPosition?: IOrganizationPosition;

	@ApiProperty({ type: () => String })
	@RelationId((it: Employee) => it.organizationPosition)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationPositionId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	// Employee Teams
	@MultiORMOneToMany(() => OrganizationTeamEmployee, (it) => it.employee, {
		cascade: true
	})
	teams?: IOrganizationTeam[];

	// Employee Project
	@MultiORMOneToMany(() => OrganizationProjectEmployee, (it) => it.employee, {
		cascade: true
	})
	projects?: IOrganizationProject[];

	// Employee Sprint
	@MultiORMOneToMany(() => OrganizationSprintEmployee, (it) => it.employee, {
		cascade: true
	})
	sprints?: IOrganizationSprint[];

	/**
	 * Estimations
	 */
	@MultiORMOneToMany(() => TaskEstimation, (it) => it.employee)
	estimations?: TaskEstimation[];

	/**
	 * Time Tracking (Timesheets)
	 */
	@MultiORMOneToMany(() => Timesheet, (it) => it.employee)
	timesheets?: ITimesheet[];

	/**
	 * Time Tracking (Time Logs)
	 */
	@MultiORMOneToMany(() => TimeLog, (it) => it.employee)
	timeLogs?: ITimeLog[];

	/**
	 * Time Tracking (Time Slots)
	 */
	@MultiORMOneToMany(() => TimeSlot, (it) => it.employee)
	timeSlots?: ITimeSlot[];

	/**
	 *
	 */
	@MultiORMOneToMany(() => InvoiceItem, (it) => it.employee, {
		onDelete: 'SET NULL'
	})
	invoiceItems?: IInvoiceItem[];

	/**
	 *
	 */
	@MultiORMOneToMany(() => RequestApprovalEmployee, (it) => it.employee)
	requestApprovals?: IRequestApprovalEmployee[];

	@MultiORMOneToMany(() => EmployeeSetting, (it) => it.employee)
	settings?: IEmployeeSetting[];

	@MultiORMOneToMany(() => Expense, (it) => it.employee)
	expenses?: IExpense[];

	/**
	 * Goal
	 */
	@MultiORMOneToMany(() => Goal, (it) => it.ownerEmployee, {
		onDelete: 'SET NULL'
	})
	goals?: IGoal[];

	/**
	 * Lead
	 */
	@MultiORMOneToMany(() => Goal, (it) => it.lead, {
		onDelete: 'SET NULL'
	})
	leads?: IGoal[];

	/**
	 * Awards
	 */
	@MultiORMOneToMany(() => EmployeeAward, (it) => it.employee, {
		onDelete: 'SET NULL'
	})
	awards?: IEmployeeAward[];

	/**
	 * Phone Numbers
	 */
	@MultiORMOneToMany(() => EmployeePhone, (it) => it.employee)
	phoneNumbers?: IEmployeePhone[];

	/**
	 * Daily Plans
	 */
	@MultiORMOneToMany(() => DailyPlan, (dailyPlan) => dailyPlan.employee, {
		cascade: true
	})
	dailyPlans?: IDailyPlan[];

	/**
	 * Favorites entity records
	 */
	@MultiORMOneToMany(() => Favorite, (favorite) => favorite.employee, {
		cascade: true
	})
	favorites?: IFavorite[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee Tags
	 */
	@MultiORMManyToMany(() => Tag, (tag) => tag.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_employee',
		joinColumn: 'employeeId',
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({
		name: 'tag_employee'
	})
	tags?: Tag[];

	/**
	 * Employee Skills
	 */
	@MultiORMManyToMany(() => Skill, (skill) => skill.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	skills?: ISkill[];

	/**
	 * Organization Departments
	 */
	@MultiORMManyToMany(() => OrganizationDepartment, (it) => it.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	organizationDepartments?: IOrganizationDepartment[];

	/**
	 * Organization Employment Types
	 */
	@MultiORMManyToMany(() => OrganizationEmploymentType, (it) => it.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	organizationEmploymentTypes?: IOrganizationEmploymentType[];

	/**
	 * Employee Organization Contacts
	 */
	@MultiORMManyToMany(() => OrganizationContact, (it) => it.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	organizationContacts?: IOrganizationContact[];

	/**
	 * TimeOffPolicy
	 */
	@MultiORMManyToMany(() => TimeOffPolicy, (timeOffPolicy) => timeOffPolicy.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		pivotTable: 'time_off_policy_employee',
		owner: true,
		joinColumn: 'employeeId',
		inverseJoinColumn: 'timeOffPolicyId'
	})
	@JoinTable({
		name: 'time_off_policy_employee'
	})
	timeOffPolicies?: ITimeOffPolicy[];

	/**
	 * TimeOffRequest
	 */
	@MultiORMManyToMany(() => TimeOffRequest, (timeOffRequest) => timeOffRequest.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'time_off_request_employee',
		joinColumn: 'employeeId',
		inverseJoinColumn: 'timeOffRequestId'
	})
	@JoinTable({
		name: 'time_off_request_employee'
	})
	timeOffRequests?: ITimeOffRequest[];

	/**
	 * Task
	 */
	@MultiORMManyToMany(() => Task, (task) => task.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable()
	tasks?: ITask[];

	/**
	 * Project Module
	 */
	@MultiORMManyToMany(() => OrganizationProjectModule, (module) => module.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	modules?: IOrganizationProjectModule[];

	/**
	 * Equipment Sharing
	 */
	@MultiORMManyToMany(() => EquipmentSharing, (it) => it.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	equipmentSharings?: IEquipmentSharing[];

	/**
	 * Comments
	 */
	@MultiORMManyToMany(() => Comment, (it) => it.members, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	assignedComments?: IComment[];

	/*
	|--------------------------------------------------------------------------
	| Embeddable Columns
	|--------------------------------------------------------------------------
	*/
	@EmbeddedColumn({
		mikroOrmEmbeddableEntity: () => MikroOrmEmployeeEntityCustomFields,
		typeOrmEmbeddableEntity: () => TypeOrmEmployeeEntityCustomFields
	})
	customFields?: EmployeeEntityCustomFields;
}
