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
	Employee,
	Invoice,
	OrganizationContact,
	OrganizationProject,
	Tag,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { IsOptional, IsUUID } from 'class-validator';

@Entity('payment')
export class Payment extends TenantOrganizationBaseEntity implements IPayment {

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	paymentDate?: Date;

	@ApiPropertyOptional({ type: () => Number })
	@Column({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	amount?: number;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	note?: string;

	@ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum })
	@Column()
	currency?: string;

	@ApiPropertyOptional({ type: () => String, enum: PaymentMethodEnum })
	@Column({
		type: 'simple-enum',
		nullable: true,
		enum: PaymentMethodEnum
	})
	paymentMethod?: PaymentMethodEnum;

	@ApiPropertyOptional({ type: () => Boolean })
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
	@Index()
	@Column()
	recordedById?: string;

	/**
	 * Organization Project Relationship
	 */
	@ApiPropertyOptional({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, (it) => it.payments, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	project?: IOrganizationProject;

	/**
	 * Organization Project ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Payment) => it.project)
	@Index()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];

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
	@Index()
	@Column({ nullable: true })
	organizationContactId?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag, (tag) => tag.payments, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_payment'
	})
	tags?: ITag[];
}
