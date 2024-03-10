import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	JoinColumn,
	JoinTable,
	RelationId,
	Index,
} from 'typeorm';
import { IsOptional, IsString } from 'class-validator';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import {
	CurrenciesEnum,
	IEmployee,
	PayPeriodEnum,
	ITag,
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
} from '@gauzy/contracts';
import {
	Candidate,
	Contact,
	EmployeeAward,
	EmployeePhone,
	EmployeeSetting,
	EquipmentSharing,
	Expense,
	Goal,
	InvoiceItem,
	JobPreset,
	OrganizationContact,
	OrganizationDepartment,
	OrganizationEmploymentType,
	OrganizationPosition,
	OrganizationProject,
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
	User,
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MikroOrmEmployeeRepository } from './repository/mikro-orm-employee.repository';
import { MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany, MultiORMOneToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('employee', { mikroOrmRepository: () => MikroOrmEmployeeRepository })
export class Employee extends TenantOrganizationBaseEntity implements IEmployee {

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 200 })
	@MultiORMColumn({ length: 200, nullable: true })
	short_description?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	startedWorkOn?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	endWork?: Date;

	@ApiProperty({ type: () => String, enum: PayPeriodEnum })
	@MultiORMColumn({ nullable: true })
	payPeriod?: string;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true })
	billRateValue?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true })
	minimumBillingRate?: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@MultiORMColumn({ nullable: true })
	billRateCurrency?: string;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true })
	reWeeklyLimit?: number;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	offerDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	acceptDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	rejectDate?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@MultiORMColumn({ length: 500, nullable: true })
	employeeLevel?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	anonymousBonus?: boolean;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe(),
	})
	averageIncome?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe(),
	})
	averageBonus?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		default: 0,
		transformer: new ColumnNumericTransformerPipe(),
	})
	totalWorkHours?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({
		type: 'numeric',
		nullable: true,
		transformer: new ColumnNumericTransformerPipe(),
	})
	averageExpenses?: number;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	show_anonymous_bonus?: boolean;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	show_average_bonus?: boolean;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	show_average_expenses?: boolean;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	show_average_income?: boolean;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	show_billrate?: boolean;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	show_payperiod?: boolean;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	show_start_work_on?: boolean;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	isJobSearchActive?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	linkedInUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	facebookUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	instagramUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	twitterUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	githubUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	gitlabUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	upworkUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	stackoverflowUrl?: string;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	isVerified?: boolean;

	@ApiProperty({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
	isVetted?: boolean;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({
		type: 'numeric',
		nullable: true,
		transformer: new ColumnNumericTransformerPipe(),
	})
	totalJobs?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({
		type: 'numeric',
		nullable: true,
		transformer: new ColumnNumericTransformerPipe(),
	})
	jobSuccess?: number;

	@ApiProperty({ type: () => String, minLength: 3, maxLength: 100 })
	@Index({ unique: false })
	@MultiORMColumn({ nullable: true })
	profile_link?: string;

	/**
	 * Enabled/Disabled Time Tracking Feature
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@MultiORMColumn({
		type: Boolean,
		nullable: true,
		default: false,
	})
	isTrackingEnabled: boolean;

	/**
	 * Employee status (Online/Offline)
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@MultiORMColumn({
		type: Boolean,
		nullable: true,
		default: false,
	})
	isOnline?: boolean;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@MultiORMColumn({
		type: Boolean,
		nullable: true,
		default: false,
	})
	isAway?: boolean;

	/**
	 * Employee time tracking status
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@MultiORMColumn({
		type: Boolean,
		nullable: true,
		default: false,
	})
	isTrackingTime?: boolean;

	/**
	 * Enabled/Disabled Screen Capture Feature
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@MultiORMColumn({ default: true })
	allowScreenshotCapture?: boolean;

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


	/**
	 * Additional Property
	 */
	fullName?: string;
	isDeleted?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User
	 */
	@ApiProperty({ type: () => User })
	@MultiORMOneToOne(() => User, (it) => it.employee, {
		cascade: true,
		onDelete: 'CASCADE',
		owner: true,
	})
	@JoinColumn()
	user: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Employee) => it.user)
	@Index()
	@MultiORMColumn({ relationId: true })
	readonly userId: string;

	/**
	 * Contact
	 */
	@ApiProperty({ type: () => Contact })
	@MultiORMOneToOne(() => Contact, (contact) => contact.employee, {
		cascade: true,
		onDelete: 'SET NULL',
		owner: true,
	})
	@JoinColumn()
	contact?: IContact;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Employee) => it.contact)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	readonly contactId?: string;

	/**
	 * Candidate
	 */
	@ApiProperty({ type: () => Candidate })
	@MultiORMOneToOne(() => Candidate, (candidate) => candidate.employee)
	candidate?: ICandidate;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	// Employee Organization Position
	@ApiProperty({ type: () => OrganizationPosition })
	@MultiORMManyToOne(() => OrganizationPosition, { nullable: true })
	@JoinColumn()
	organizationPosition?: IOrganizationPosition;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Employee) => it.organizationPosition)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	readonly organizationPositionId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	// Employee Teams
	@ApiPropertyOptional({
		type: () => OrganizationTeamEmployee,
		isArray: true,
	})
	@MultiORMOneToMany(() => OrganizationTeamEmployee, (it) => it.employee)
	teams?: IOrganizationTeam[];

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

	@ApiPropertyOptional({ type: () => InvoiceItem, isArray: true })
	@MultiORMOneToMany(() => InvoiceItem, (it) => it.employee, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	@ApiPropertyOptional({ type: () => RequestApprovalEmployee, isArray: true })
	@MultiORMOneToMany(() => RequestApprovalEmployee, (it) => it.employee)
	requestApprovals?: IRequestApprovalEmployee[];

	@ApiPropertyOptional({ type: () => EmployeeSetting, isArray: true })
	@MultiORMOneToMany(() => EmployeeSetting, (it) => it.employee)
	settings?: IEmployeeSetting[];

	@ApiPropertyOptional({ type: () => Expense, isArray: true })
	@MultiORMOneToMany(() => Expense, (it) => it.employee)
	expenses?: IExpense[];

	/**
	 * Goal
	 */
	@ApiPropertyOptional({ type: () => Goal, isArray: true })
	@MultiORMOneToMany(() => Goal, (it) => it.ownerEmployee, {
		onDelete: 'SET NULL',
	})
	goals?: IGoal[];

	/**
	 * Lead
	 */
	@ApiPropertyOptional({ type: () => Goal, isArray: true })
	@MultiORMOneToMany(() => Goal, (it) => it.lead, {
		onDelete: 'SET NULL',
	})
	leads?: IGoal[];

	/**
	 * Awards
	 */
	@ApiPropertyOptional({ type: () => EmployeeAward, isArray: true })
	@MultiORMOneToMany(() => EmployeeAward, (it) => it.employee, {
		onDelete: 'SET NULL',
	})
	awards?: IEmployeeAward[];

	/**
	 * Phone Numbers
	 */
	@ApiPropertyOptional({ type: () => EmployeePhone, isArray: true })
	@MultiORMOneToMany(() => EmployeePhone, (it) => it.employee)
	phoneNumbers?: IEmployeePhone[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee Organization Projects
	 */
	@MultiORMManyToMany(() => OrganizationProject, (it) => it.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'organization_project_employee',
		joinColumn: 'employeeId',
		inverseJoinColumn: 'organizationProjectId',
	})
	@JoinTable({
		name: 'organization_project_employee',
	})
	projects?: IOrganizationProject[];

	/**
	 * Employee Tags
	 */
	@MultiORMManyToMany(() => Tag, (tag) => tag.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_employee',
		joinColumn: 'employeeId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_employee',
	})
	tags: ITag[];

	/**
	 * Employee Skills
	 */
	@ApiProperty({ type: () => Skill })
	@MultiORMManyToMany(() => Skill, (skill) => skill.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	skills: ISkill[];

	/**
	 * Organization Departments
	 */
	@ApiProperty({ type: () => OrganizationDepartment })
	@MultiORMManyToMany(() => OrganizationDepartment, (it) => it.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	organizationDepartments?: IOrganizationDepartment[];

	/**
	 * Organization Employment Types
	 */
	@ApiProperty({ type: () => OrganizationEmploymentType })
	@MultiORMManyToMany(() => OrganizationEmploymentType, (it) => it.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	organizationEmploymentTypes?: IOrganizationEmploymentType[];

	/**
	 * Employee Job Presets
	 */
	@ApiProperty({ type: () => JobPreset })
	@MultiORMManyToMany(() => JobPreset, (jobPreset) => jobPreset.employees)
	jobPresets?: JobPreset[];

	/**
	 * Employee Organization Contacts
	 */
	@MultiORMManyToMany(() => OrganizationContact, (it) => it.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	organizationContacts?: IOrganizationContact[];

	/**
	 * TimeOffPolicy
	 */
	@MultiORMManyToMany(
		() => TimeOffPolicy,
		(timeOffPolicy) => timeOffPolicy.employees,
		{
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE',
			pivotTable: 'time_off_policy_employee',
			owner: true,
			joinColumn: 'employeeId',
			inverseJoinColumn: 'timeOffPolicyId',
		}
	)
	@JoinTable({
		name: 'time_off_policy_employee',
	})
	timeOffPolicies?: ITimeOffPolicy[];

	/**
	 * TimeOffRequest
	 */
	@MultiORMManyToMany(
		() => TimeOffRequest,
		(timeOffRequest) => timeOffRequest.employees,
		{
			onUpdate: 'CASCADE',
			onDelete: 'CASCADE',
			owner: true,
			pivotTable: 'time_off_request_employee',
			joinColumn: 'employeeId',
			inverseJoinColumn: 'timeOffRequestId',
		}
	)
	@JoinTable({
		name: 'time_off_request_employee',
	})
	timeOffRequests?: ITimeOffRequest[];

	/**
	 * Task
	 */
	@MultiORMManyToMany(() => Task, (task) => task.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	@JoinTable()
	tasks?: ITask[];

	/**
	 * Equipment Sharing
	 */
	@MultiORMManyToMany(() => EquipmentSharing, (it) => it.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	equipmentSharings?: IEquipmentSharing[];
}
