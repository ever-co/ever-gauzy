import {
	JoinColumn,
	JoinTable,
	RelationId
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
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmPaymentRepository } from './repository/mikro-orm-payment.repository';

@MultiORMEntity('payment', { mikroOrmRepository: () => MikroOrmPaymentRepository })
export class Payment extends TenantOrganizationBaseEntity implements IPayment {

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	paymentDate?: Date;

	@ApiPropertyOptional({ type: () => Number })
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	amount?: number;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	note?: string;

	@ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum })
	@MultiORMColumn()
	currency?: string;

	@ApiPropertyOptional({ type: () => String, enum: PaymentMethodEnum })
	@MultiORMColumn({
		type: 'simple-enum',
		nullable: true,
		enum: PaymentMethodEnum
	})
	paymentMethod?: PaymentMethodEnum;

	@ApiPropertyOptional({ type: () => Boolean })
	@MultiORMColumn({ nullable: true })
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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: string;

	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * Invoice
	 */
	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: Payment) => it.invoice)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	invoiceId?: string;

	@ApiPropertyOptional({ type: () => Invoice })
	@MultiORMManyToOne(() => Invoice, (invoice) => invoice.payments, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice?: IInvoice;

	/**
	 * User
	 */
	@ApiPropertyOptional({ type: () => User })
	@MultiORMManyToOne(() => User)
	@JoinColumn()
	recordedBy?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Payment) => it.recordedBy)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	recordedById?: IUser['id'];

	/**
	 * Organization Project Relationship
	 */
	@ApiPropertyOptional({ type: () => OrganizationProject })
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.payments, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL'
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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * OrganizationContact
	 */
	@ApiPropertyOptional({ type: () => OrganizationContact })
	@MultiORMManyToOne(() => OrganizationContact, (organizationContact) => organizationContact.payments, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: Payment) => it.organizationContact)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationContactId?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Tag, isArray: true })
	@MultiORMManyToMany(() => Tag, (tag) => tag.payments, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_payment',
		joinColumn: 'paymentId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_payment'
	})
	tags?: ITag[];
}
