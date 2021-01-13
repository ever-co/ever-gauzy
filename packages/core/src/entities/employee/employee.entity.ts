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
	IPayment
} from '@gauzy/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsDate,
	IsEnum,
	IsNumber,
	IsOptional,
	IsBoolean
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
	OneToMany
} from 'typeorm';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { OrganizationEmploymentType } from '../organization-employment-type/organization-employment-type.entity';
import { OrganizationPositions } from '../organization-positions/organization-positions.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { Tag } from '../tags/tag.entity';
import { User } from '../user/user.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { RequestApprovalEmployee } from '../request-approval-employee/request-approval-employee.entity';
import { Skill } from '../skills/skill.entity';
import { Contact } from '../contact/contact.entity';
import { TimeLog } from '../timesheet/time-log.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';
import { Payment } from '../payment/payment.entity';
import { JobPreset } from '../employee-job-preset/job-preset.entity';

@Entity('employee')
export class Employee extends TenantOrganizationBase implements IEmployee {
	@ManyToMany((type) => Tag, (tag) => tag.employee)
	@JoinTable({
		name: 'tag_employee'
	})
	tags: ITag[];

	@ApiProperty({ type: Contact })
	@ManyToOne(() => Contact, (contact) => contact.employees, {
		nullable: true,
		cascade: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	contact: IContact;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((employee: Employee) => employee.contact)
	readonly contactId?: string;

	@ManyToMany((type) => Skill, (skill) => skill.employees)
	@JoinTable({
		name: 'skill_employee'
	})
	skills: ISkill[];

	@ApiProperty({ type: User })
	@OneToOne((type) => User, {
		nullable: false,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user: IUser;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((employee: Employee) => employee.user)
	@Column()
	readonly userId: string;

	@ApiProperty({ type: OrganizationPositions })
	@ManyToOne((type) => OrganizationPositions, { nullable: true })
	@JoinColumn()
	organizationPosition?: IOrganizationPosition;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((employee: Employee) => employee.organizationPosition)
	readonly organizationPositionId?: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: Boolean, default: true })
	@Column({ nullable: true, default: true })
	isActive: boolean;

	@ApiPropertyOptional({ type: String, maxLength: 200 })
	@IsOptional()
	@Column({ length: 200, nullable: true })
	short_description?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	startedWorkOn?: Date;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	endWork?: Date;

	@ApiProperty({ type: String, enum: PayPeriodEnum })
	@IsEnum(PayPeriodEnum)
	@IsOptional()
	@Column({ nullable: true })
	payPeriod?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	billRateValue?: number;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsOptional()
	@Column({ nullable: true })
	billRateCurrency?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true })
	reWeeklyLimit?: number;

	@OneToMany(
		(type) => OrganizationTeamEmployee,
		(organizationTeamEmployee) => organizationTeamEmployee.employee
	)
	teams?: IOrganizationTeam[];

	@OneToMany((type) => TimeLog, (timeLog) => timeLog.employee)
	timeLogs?: ITimeLog[];

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	offerDate?: Date;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	acceptDate?: Date;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	rejectDate?: Date;

	@ManyToMany(
		(type) => OrganizationDepartment,
		(organizationDepartment) => organizationDepartment.members,
		{ cascade: true }
	)
	organizationDepartments?: IOrganizationDepartment[];

	@ManyToMany(
		(type) => OrganizationEmploymentType,
		(organizationEmploymentType) => organizationEmploymentType.members,
		{ cascade: true }
	)
	organizationEmploymentTypes?: IOrganizationEmploymentType[];

	@ManyToMany(() => JobPreset, (jobPreset) => jobPreset.employees)
	jobPresets?: JobPreset[];

	@ApiPropertyOptional({ type: String, maxLength: 500 })
	@IsOptional()
	@Column({ length: 500, nullable: true })
	employeeLevel?: string;

	@ApiPropertyOptional({ type: Boolean })
	@Column({ nullable: true })
	anonymousBonus?: boolean;

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany((type) => InvoiceItem, (invoiceItem) => invoiceItem.employee, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	@ApiPropertyOptional({ type: Payment, isArray: true })
	@OneToMany((type) => Payment, (payments) => payments.recordedBy)
	@JoinColumn()
	payments?: IPayment[];

	@OneToMany(
		(type) => RequestApprovalEmployee,
		(requestApprovals) => requestApprovals.employee
	)
	requestApprovals?: IRequestApprovalEmployee[];

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	averageIncome?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	averageBonus?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', default: 0 })
	totalWorkHours?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	averageExpenses?: number;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_anonymous_bonus?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_average_bonus?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_average_expenses?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_average_income?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_billrate?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_payperiod?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	show_start_work_on?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isJobSearchActive?: boolean;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	linkedInUrl?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	facebookUrl?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	instagramUrl?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	twitterUrl?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	githubUrl?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	gitlabUrl?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	upworkUrl?: string;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isVerified?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isVetted?: boolean;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	totalJobs?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	jobSuccess?: number;
}
