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
	ITimesheet
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsDate,
	IsEnum,
	IsNumber,
	IsOptional,
	IsBoolean,
	IsString
} from 'class-validator';
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
	Contact,
	EmployeeSetting,
	Expense,
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
	TenantOrganizationBaseEntity,
	TimeLog,
	TimeOffPolicy,
	TimeOffRequest,
	Timesheet,
	User
} from '../core/entities/internal';

@Entity('employee')
export class Employee
	extends TenantOrganizationBaseEntity
	implements IEmployee {
	
	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@Column({ nullable: true, default: true })
	isActive: boolean;

	@ApiPropertyOptional({ type: () => String, maxLength: 200 })
	@IsOptional()
	@Column({ length: 200, nullable: true })
	short_description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	startedWorkOn?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	endWork?: Date;

	@ApiProperty({ type: () => String, enum: PayPeriodEnum })
	@IsEnum(PayPeriodEnum)
	@IsOptional()
	@Column({ nullable: true })
	payPeriod?: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	billRateValue?: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsOptional()
	@Column({ nullable: true })
	billRateCurrency?: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true })
	reWeeklyLimit?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	offerDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	acceptDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	rejectDate?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@Column({ length: 500, nullable: true })
	employeeLevel?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ nullable: true })
	anonymousBonus?: boolean;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	averageIncome?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	averageBonus?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', default: 0 })
	totalWorkHours?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	averageExpenses?: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_anonymous_bonus?: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_average_bonus?: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_average_expenses?: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_average_income?: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_billrate?: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_payperiod?: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_start_work_on?: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isJobSearchActive?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	linkedInUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	facebookUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	instagramUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	twitterUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	githubUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	gitlabUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	upworkUrl?: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isVerified?: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isVetted?: boolean;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	totalJobs?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	jobSuccess?: number;

	fullName?: string;
	
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 100 })
	@IsString()
	@Index({ unique: false })
	@IsOptional()
	@Column({ nullable: true })
	profile_link?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToOne 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => User })
	@OneToOne(() => User, {
		nullable: false,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user: IUser;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Employee) => it.user)
	@IsString()
	@Index()
	@Column()
	readonly userId: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	// Employee Contact
	@ApiProperty({ type: () => Contact })
	@ManyToOne(() => Contact, (contact) => contact.employees, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	contact: IContact;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Employee) => it.contact)
	@IsString()
	@Index()
	@Column({ nullable: true })
	readonly contactId?: string;

	// Employee Organization Position
	@ApiProperty({ type: () => OrganizationPosition })
	@ManyToOne(() => OrganizationPosition, { nullable: true })
	@JoinColumn()
	organizationPosition?: IOrganizationPosition;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Employee) => it.organizationPosition)
	@IsString()
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

	// Employee Time Logs
	@ApiPropertyOptional({ type: () => TimeLog, isArray: true })
	@OneToMany(() => TimeLog, (it) => it.employee)
	timeLogs?: ITimeLog[];

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

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */

	// Employee Organization Projects
	@ManyToMany(() => OrganizationProject, (it) => it.members, {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
    @JoinTable({
		name: 'organization_project_employee'
	})
    projects?: IOrganizationProject[];

	// Employee Tags
	@ManyToMany(() => Tag, (tag) => tag.employee)
	@JoinTable({
		name: 'tag_employee'
	})
	tags: ITag[];

	// Employee Skills
	@ApiProperty({ type: () => Skill })
	@ManyToMany(() => Skill, (skill) => skill.employees)
    skills: ISkill[];

	// Organization Departments
	@ApiProperty({ type: () => OrganizationDepartment })
	@ManyToMany(() => OrganizationDepartment, (it) => it.members, { 
		cascade: true 
	})
	organizationDepartments?: IOrganizationDepartment[];

	// Organization Employment Types
	@ApiProperty({ type: () => OrganizationEmploymentType })
	@ManyToMany(() => OrganizationEmploymentType, (it) => it.members, { 
		cascade: true 
	})
	organizationEmploymentTypes?: IOrganizationEmploymentType[];

	// Employee Job Presets
	@ApiProperty({ type: () => JobPreset })
	@ManyToMany(() => JobPreset, (jobPreset) => jobPreset.employees)
	jobPresets?: JobPreset[];


	// Employee Organization Contacts
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
}
