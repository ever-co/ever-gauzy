import {
	Entity,
	Column,
	ManyToOne,
	JoinColumn,
	JoinTable,
	ManyToMany,
	RelationId
} from 'typeorm';
import {
	IPayment,
	CurrenciesEnum,
	PaymentMethodEnum,
	IEmployee
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsEnum,
	IsString,
	IsOptional,
	IsDate,
	IsNumber,
	IsBoolean
} from 'class-validator';
import {
	Employee,
	Invoice,
	OrganizationContact,
	OrganizationProject,
	Tag,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';

@Entity('payment')
export class Payment extends TenantOrganizationBaseEntity implements IPayment {
	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	invoiceId?: string;

	@ApiPropertyOptional({ type: Invoice })
	@ManyToOne(() => Invoice, (invoice) => invoice.payments, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice?: Invoice;

	@ApiProperty({ type: String })
	@RelationId((expense: Payment) => expense.employee)
	@Column({ nullable: true })
	employeeId?: string;

	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: User })
	@ManyToOne(() => User)
	@JoinColumn()
	recordedBy?: User;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	paymentDate?: Date;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'numeric' })
	amount?: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	note?: string;

	@ApiPropertyOptional({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@Column()
	currency?: string;

	@ApiPropertyOptional({ type: String, enum: PaymentMethodEnum })
	@IsEnum(PaymentMethodEnum)
	@IsOptional()
	@Column({ nullable: true })
	paymentMethod?: string;

	@ApiPropertyOptional({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	overdue?: boolean;

	@ApiPropertyOptional({ type: OrganizationProject })
	@ManyToOne(() => OrganizationProject, (project) => project.payments, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	project?: OrganizationProject;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	projectId?: string;

	@ApiPropertyOptional({ type: OrganizationContact })
	@ManyToOne(() => OrganizationContact, (contact) => contact.payments, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	contact?: OrganizationContact;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	contactId?: string;

	@ManyToMany(() => Tag, (tag) => tag.payment)
	@JoinTable({
		name: 'tag_payment'
	})
	tags?: Tag[];
}
