import {
	Entity,
	Column,
	ManyToOne,
	JoinColumn,
	JoinTable,
	ManyToMany,
	RelationId,
	Index
} from 'typeorm';
import {
	IPayment,
	CurrenciesEnum,
	PaymentMethodEnum,
	IEmployee,
	IInvoice,
	ITag,
	IOrganizationContact,
	IOrganizationProject,
	IUser
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
	
	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	paymentDate?: Date;

	@ApiPropertyOptional({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'numeric' })
	amount?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	note?: string;

	@ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@Column()
	currency?: string;

	@ApiPropertyOptional({ type: () => String, enum: PaymentMethodEnum })
	@IsEnum(PaymentMethodEnum)
	@IsOptional()
	@Column({ nullable: true })
	paymentMethod?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	overdue?: boolean;
	
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => String })
	@RelationId((it: Payment) => it.employee)
	@IsString()
	@Index()
	@Column({ nullable: true })
	employeeId?: string;

	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * Invoice
	 */
	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: Payment) => it.invoice)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	invoiceId?: string;

	@ApiPropertyOptional({ type: () => Invoice })
	@ManyToOne(() => Invoice, (invoice) => invoice.payments, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice?: IInvoice;

	/**
	 * User
	 */
	@ApiPropertyOptional({ type: () => User })
	@ManyToOne(() => User)
	@JoinColumn()
	recordedBy?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Payment) => it.recordedBy)
	@IsString()
	@Index()
	@Column()
	recordedById?: string;

	/**
	 * OrganizationProject
	 */
	@ApiPropertyOptional({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, (project) => project.payments, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: Payment) => it.project)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	projectId?: string;

	/**
	 * OrganizationContact
	 */
	@ApiPropertyOptional({ type: () => OrganizationContact })
	@ManyToOne(() => OrganizationContact, (organizationContact) => organizationContact.payments, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: Payment) => it.organizationContact)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	organizationContactId?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	@ManyToMany(() => Tag, (tag) => tag.payment)
	@JoinTable({
		name: 'tag_payment'
	})
	tags?: ITag[];
}
