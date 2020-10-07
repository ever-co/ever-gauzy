import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	ManyToMany,
	JoinTable,
	OneToMany,
	RelationId
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsOptional,
	IsDate,
	IsEnum,
	IsBoolean
} from 'class-validator';
import {
	IOrganizationProject,
	CurrenciesEnum,
	TaskListTypeEnum,
	IOrganizationContact,
	IInvoiceItem,
	ITag,
	ITask,
	ITimeLog,
	IEmployee,
	IOrganizationSprint,
	IPayment
} from '@gauzy/models';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import { Employee } from '../employee/employee.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { Tag } from '../tags/tag.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
import { Task } from '../tasks/task.entity';
import { OrganizationSprint } from '../organization-sprint/organization-sprint.entity';
import { Payment } from '../payment/payment.entity';
import { TimeLog } from '../timesheet/time-log.entity';

@Entity('organization_project')
export class OrganizationProject extends TenantOrganizationBase
	implements IOrganizationProject {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.organizationProject)
	@JoinTable({
		name: 'tag_organization_project'
	})
	tags: ITag[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiPropertyOptional({ type: OrganizationContact })
	@ManyToOne(
		(type) => OrganizationContact,
		(organizationContact) => organizationContact.projects,
		{
			nullable: true,
			onDelete: 'CASCADE'
		}
	)
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiProperty({ type: String })
	@RelationId((contact: OrganizationProject) => contact.organizationContact)
	@Column({ nullable: true })
	organizationContactId?: string;

	@ApiProperty({ type: Task })
	@OneToMany((type) => Task, (task) => task.project)
	@JoinColumn()
	tasks?: ITask[];

	@OneToMany((type) => TimeLog, (timeLog) => timeLog.project)
	timeLogs?: ITimeLog[];

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	startDate?: Date;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	endDate?: Date;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	billing: string;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column({ nullable: true })
	currency: string;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	public: boolean;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'organization_project_employee'
	})
	members?: IEmployee[];

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany((type) => InvoiceItem, (invoiceItem) => invoiceItem.project, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	owner: string;

	@ApiPropertyOptional({ type: OrganizationSprint })
	@OneToMany((type) => OrganizationSprint, (sprints) => sprints.project)
	@JoinColumn()
	organizationSprints?: IOrganizationSprint[];

	@ApiProperty({ type: String, enum: TaskListTypeEnum })
	@IsEnum(TaskListTypeEnum)
	@Column({ default: TaskListTypeEnum.GRID })
	taskListType: string;

	@ApiPropertyOptional({ type: Payment, isArray: true })
	@OneToMany((type) => Payment, (payment) => payment.project, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	payments?: IPayment[];

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	code?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	color?: string;

	@ApiPropertyOptional({ type: Boolean })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	billable?: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	billingFlat?: boolean;
}
