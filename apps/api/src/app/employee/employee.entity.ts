import {
	CurrenciesEnum,
	Employee as IEmployee,
	PayPeriodEnum
} from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNumber, IsOptional } from 'class-validator';
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
import { TenantLocationBase } from '../core/entities/tenant-location-base';
import { Organization } from '../organization/organization.entity';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { OrganizationEmploymentType } from '../organization-employment-type/organization-employment-type.entity';
import { OrganizationPositions } from '../organization-positions/organization-positions.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { Tag } from '../tags/tag.entity';
import { User } from '../user/user.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { RequestApprovalEmployee } from '../request-approval-employee/request-approval-employee.entity';

@Entity('employee')
export class Employee extends TenantLocationBase implements IEmployee {
	@ManyToMany((type) => Tag, (tag) => tag.employee)
	@JoinTable({
		name: 'tag_employee'
	})
	tags: Tag[];

	@ApiProperty({ type: User })
	@OneToOne((type) => User, {
		nullable: false,
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user: User;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((employee: Employee) => employee.user)
	@Column()
	readonly userId: string;

	@ApiProperty({ type: OrganizationPositions })
	@ManyToOne((type) => OrganizationPositions, { nullable: true })
	@JoinColumn()
	organizationPosition?: OrganizationPositions;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((employee: Employee) => employee.organizationPosition)
	readonly organizationPositionId?: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((employee: Employee) => employee.organization)
	readonly orgId: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: Boolean, default: true })
	@Column({ nullable: true, default: true })
	isActive: boolean;

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
	teams?: OrganizationTeam[];

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
	organizationDepartments?: OrganizationDepartment[];

	@ManyToMany(
		(type) => OrganizationEmploymentType,
		(organizationEmploymentType) => organizationEmploymentType.members,
		{ cascade: true }
	)
	organizationEmploymentTypes?: OrganizationEmploymentType[];

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
	invoiceItems?: InvoiceItem[];

	@OneToMany(
		(type) => RequestApprovalEmployee,
		(requestApprovals) => requestApprovals.employee
	)
	requestApprovals?: RequestApprovalEmployee[];
}
