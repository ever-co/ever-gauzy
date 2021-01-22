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
	IPayment,
	OrganizationProjectBudgetTypeEnum,
	DeepPartial
} from '@gauzy/common';
import {
	Employee,
	InvoiceItem,
	OrganizationContact,
	OrganizationSprint,
	Payment,
	Tag,
	Task,
	TenantOrganizationBaseEntity,
	TimeLog
} from '../internal';

@Entity('organization_project')
export class OrganizationProject
	extends TenantOrganizationBaseEntity
	implements IOrganizationProject {
	constructor(input?: DeepPartial<OrganizationProject>) {
		super(input);
	}

	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.organizationProject)
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
		() => OrganizationContact,
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
	@OneToMany(() => Task, (task) => task.project)
	@JoinColumn()
	tasks?: ITask[];

	@OneToMany(() => TimeLog, (timeLog) => timeLog.project)
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

	@ManyToMany(() => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'organization_project_employee'
	})
	members?: IEmployee[];

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.project, {
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
	@OneToMany(() => OrganizationSprint, (sprints) => sprints.project)
	@JoinColumn()
	organizationSprints?: IOrganizationSprint[];

	@ApiProperty({ type: String, enum: TaskListTypeEnum })
	@IsEnum(TaskListTypeEnum)
	@Column({ default: TaskListTypeEnum.GRID })
	taskListType: string;

	@ApiPropertyOptional({ type: Payment, isArray: true })
	@OneToMany(() => Payment, (payment) => payment.project, {
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

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@Column({ nullable: true })
	openSource?: boolean;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	projectUrl?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	openSourceProjectUrl?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	budget?: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({
		type: 'text',
		nullable: true,
		default: OrganizationProjectBudgetTypeEnum.COST
	})
	budgetType?: OrganizationProjectBudgetTypeEnum;
}
