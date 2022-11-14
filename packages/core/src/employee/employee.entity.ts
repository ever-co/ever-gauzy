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
	IPayment,
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
	IEmployeeAward
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import {
	Column,
	Entity,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
	OneToOne,
	RelationId,
	OneToMany,
	Index
} from 'typeorm';
import {
	Candidate,
	Contact,
	EmployeeAward,
	EmployeeSetting,
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
	Payment,
	RequestApprovalEmployee,
	Skill,
	Tag,
	Task,
	TenantOrganizationBaseEntity,
	TimeLog,
	TimeOffPolicy,
	TimeOffRequest,
	Timesheet,
	TimeSlot,
	User
} from '../core/entities/internal';

@Entity('employee')
export class Employee extends TenantOrganizationBaseEntity
	implements IEmployee {

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@Column({ nullable: true, default: true })
	isActive: boolean;

	@ApiPropertyOptional({ type: () => String, maxLength: 200 })
	@Column({ length: 200, nullable: true })
	short_description?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	startedWorkOn?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	endWork?: Date;

	@ApiProperty({ type: () => String, enum: PayPeriodEnum })
	@Column({ nullable: true })
	payPeriod?: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	billRateValue?: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@Column({ nullable: true })
	billRateCurrency?: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	reWeeklyLimit?: number;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	offerDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	acceptDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	rejectDate?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@Column({ length: 500, nullable: true })
	employeeLevel?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ nullable: true })
	anonymousBonus?: boolean;

	@ApiProperty({ type: () => Number })
	@Column({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	averageIncome?: number;

	@ApiProperty({ type: () => Number })
	@Column({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	averageBonus?: number;

	@ApiProperty({ type: () => Number })
	@Column({
		nullable: true,
		type: 'numeric',
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	totalWorkHours?: number;

	@ApiProperty({ type: () => Number })
	@Column({
		type: 'numeric',
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	averageExpenses?: number;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_anonymous_bonus?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_average_bonus?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_average_expenses?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_average_income?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_billrate?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_payperiod?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_start_work_on?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	isJobSearchActive?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	linkedInUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	facebookUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	instagramUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	twitterUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	githubUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	gitlabUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	upworkUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	stackoverflowUrl?: string;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	isVerified?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	isVetted?: boolean;

	@ApiProperty({ type: () => Number })
	@Column({
		type: 'numeric',
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	totalJobs?: number;

	@ApiProperty({ type: () => Number })
	@Column({
		type: 'numeric',
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	jobSuccess?: number;

	@ApiProperty({ type: () => String, minLength: 3, maxLength: 100 })
	@Index({ unique: false })
	@Column({ nullable: true })
	profile_link?: string;

	/**
	 * Enabled/Disabled Time Tracking Feature
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@Column({
		type: Boolean,
		nullable: true,
		default: false
	})
	isTrackingEnabled: boolean;

	/**
	 * Additional Property
	 */
	fullName?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToOne
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => User })
	@OneToOne(() => User, (user) => user.employee, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user: IUser;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Employee) => it.user)
	@Index()
	@Column()
	readonly userId: string;

	/**
	 * Contact
	 */
	@ApiProperty({ type: () => Contact })
	@OneToOne(() => Contact, (contact) => contact.employee, {
		cascade: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	contact?: IContact;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Employee) => it.contact)
	@Index()
	@Column({ nullable: true })
	readonly contactId?: string;

	/**
	 * Candidate
	 */
	@ApiProperty({ type: () => Candidate })
	@OneToOne(() => Candidate, (candidate) => candidate.employee)
	candidate?: ICandidate;
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

	// Employee Organization Position
	@ApiProperty({ type: () => OrganizationPosition })
	@ManyToOne(() => OrganizationPosition, { nullable: true })
	@JoinColumn()
	organizationPosition?: IOrganizationPosition;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Employee) => it.organizationPosition)
	@Index()
	@Column({ nullable: true })
	readonly organizationPositionId?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany
    |--------------------------------------------------------------------------
    */

	// Employee Teams
	@ApiPropertyOptional({ type: () => OrganizationTeamEmployee, isArray: true })
	@OneToMany(() => OrganizationTeamEmployee, (it) => it.employee)
	teams?: IOrganizationTeam[];

	/**
	 * Employee Time Logs
	 */
	@ApiPropertyOptional({ type: () => TimeLog, isArray: true })
	@OneToMany(() => TimeLog, (it) => it.employee)
	timeLogs?: ITimeLog[];

	/**
	 * Employee Time Slots
	 */
	@ApiPropertyOptional({ type: () => TimeSlot, isArray: true })
	@OneToMany(() => TimeSlot, (it) => it.employee)
	timeSlots?: ITimeSlot[];

	@ApiPropertyOptional({ type: () => InvoiceItem, isArray: true })
	@OneToMany(() => InvoiceItem, (it) => it.employee, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	@ApiPropertyOptional({ type: () => Payment, isArray: true })
	@OneToMany(() => Payment, (it) => it.recordedBy)
	@JoinColumn()
	payments?: IPayment[];

	@ApiPropertyOptional({ type: () => RequestApprovalEmployee, isArray: true })
	@OneToMany(() => RequestApprovalEmployee, (it) => it.employee)
	requestApprovals?: IRequestApprovalEmployee[];

	@ApiPropertyOptional({ type: () => EmployeeSetting, isArray: true })
	@OneToMany(() => EmployeeSetting, (it) => it.employee)
	settings?: IEmployeeSetting[];

	@ApiPropertyOptional({ type: () => Expense, isArray: true })
	@OneToMany(() => Expense, (it) => it.employee)
	expenses?: IExpense[];

	/**
	 * Timesheet
	 */
	@ApiPropertyOptional({ type: () => Timesheet, isArray: true })
	@OneToMany(() => Timesheet, (it) => it.employee, {
		cascade: true
	})
	timesheets?: ITimesheet[];

	/**
	 * Goal
	 */
	@ApiPropertyOptional({ type: () => Goal, isArray: true })
	@OneToMany(() => Goal, (it) => it.ownerEmployee, {
		onDelete: 'SET NULL'
	})
	goals?: IGoal[];

	/**
	 * Lead
	 */
	@ApiPropertyOptional({ type: () => Goal, isArray: true })
	@OneToMany(() => Goal, (it) => it.lead, {
		onDelete: 'SET NULL'
	})
	leads?: IGoal[];

	/**
	 * Awards
	 */
	@ApiPropertyOptional({ type: () => EmployeeAward, isArray: true })
	@OneToMany(() => EmployeeAward, (it) => it.employee, {
		onDelete: 'SET NULL'
	})
	awards?: IEmployeeAward[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany
    |--------------------------------------------------------------------------
    */

	/**
	 * Employee Organization Projects
	 */
	@ManyToMany(() => OrganizationProject, (it) => it.members, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
    @JoinTable({
		name: 'organization_project_employee'
	})
    projects?: IOrganizationProject[];

	/**
	 * Employee Tags
	 */
	@ManyToMany(() => Tag, (tag) => tag.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_employee'
	})
	tags: ITag[];

	/**
	 * Employee Skills
	 */
	@ApiProperty({ type: () => Skill })
	@ManyToMany(() => Skill, (skill) => skill.employees, {
        cascade: true
    })
	@JoinTable({
		name: 'skill_employee'
	})
    skills: ISkill[];

	/**
	 * Organization Departments
	 */
	@ApiProperty({ type: () => OrganizationDepartment })
	@ManyToMany(() => OrganizationDepartment, (it) => it.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	organizationDepartments?: IOrganizationDepartment[];

	/**
	 * Organization Employment Types
	 */
	@ApiProperty({ type: () => OrganizationEmploymentType })
	@ManyToMany(() => OrganizationEmploymentType, (it) => it.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	organizationEmploymentTypes?: IOrganizationEmploymentType[];

	/**
	 * Employee Job Presets
	 */
	@ApiProperty({ type: () => JobPreset })
	@ManyToMany(() => JobPreset, (jobPreset) => jobPreset.employees)
	jobPresets?: JobPreset[];

	/**
	 * Employee Organization Contacts
	 */
	@ManyToMany(() => OrganizationContact, (it) => it.members, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
    @JoinTable({
		name: 'organization_contact_employee'
	})
    organizationContacts?: IOrganizationContact[];

	/**
	 * TimeOffPolicy
	 */
	@ManyToMany(() => TimeOffPolicy, (timeOffPolicy) => timeOffPolicy.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'time_off_policy_employee'
	})
	timeOffPolicies?: ITimeOffPolicy[];

	/**
	 * TimeOffRequest
	 */
	@ManyToMany(() => TimeOffRequest, (timeOffRequest) => timeOffRequest.employees, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'time_off_request_employee'
	})
	timeOffRequests?: ITimeOffRequest[];

	/**
	 * Task
	 */
	@ManyToMany(() => Task, (task) => task.members, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable()
	tasks?: ITask[];
}
