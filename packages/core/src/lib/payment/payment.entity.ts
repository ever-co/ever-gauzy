import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	IPayment,
	CurrenciesEnum,
	PaymentMethodEnum,
	IEmployee,
	IInvoice,
	ITag,
	IOrganizationContact,
	IOrganizationProject,
	ID
} from '@gauzy/contracts';
import {
	Employee,
	Invoice,
	OrganizationContact,
	OrganizationProject,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne
} from './../core/decorators/entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MikroOrmPaymentRepository } from './repository/mikro-orm-payment.repository';

@MultiORMEntity('payment', { mikroOrmRepository: () => MikroOrmPaymentRepository })
export class Payment extends TenantOrganizationBaseEntity implements IPayment {
	/**
	 * The date of the payment.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	paymentDate?: Date;

	/**
	 * The amount of the payment.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', transformer: new ColumnNumericTransformerPipe() })
	amount?: number;

	/**
	 * A note associated with the payment.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	note?: string;

	/**
	 * The currency of the payment.
	 */
	@ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum })
	@IsOptional()
	@IsEnum(CurrenciesEnum)
	@MultiORMColumn()
	currency?: string;

	/**
	 * The payment method of the payment.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentMethodEnum })
	@IsOptional()
	@IsEnum(PaymentMethodEnum)
	@MultiORMColumn({ type: 'simple-enum', nullable: true, enum: PaymentMethodEnum })
	paymentMethod?: PaymentMethodEnum;

	/**
	 * The overdue status of the payment.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	overdue?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The employee associated with this payment.
	 */
	@MultiORMManyToOne(() => Employee, {
		nullable: true, // Indicates if the relation column value can be nullable or not.
		onDelete: 'SET NULL' // Database cascade action on delete.
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * The employee ID associated with this payment.
	 */
	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Payment) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;

	/**
	 * The invoice associated with this payment.
	 */
	@ApiPropertyOptional({ type: () => Invoice })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => Invoice, (invoice) => invoice.payments, {
		nullable: true, // Indicates if the relation column value can be nullable or not.
		onDelete: 'SET NULL' // Database cascade action on delete.
	})
	@JoinColumn()
	invoice?: IInvoice;

	/**
	 * The invoice ID associated with this payment.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Payment) => it.invoice)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	invoiceId?: ID;

	/**
	 * The project associated with this payment.
	 */
	@ApiPropertyOptional({ type: () => OrganizationProject })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.payments, {
		nullable: true, // Indicates if the relation column value can be nullable or not.
		onDelete: 'SET NULL' // Defines the database cascade action on delete.
	})
	@JoinColumn()
	project?: IOrganizationProject;

	/**
	 * The project ID associated with this payment.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Payment) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;

	/**
	 * The organization contact associated with this payment.
	 */
	@ApiPropertyOptional({ type: () => OrganizationContact })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => OrganizationContact, (it) => it.payments, {
		nullable: true, // Indicates if the relation column value can be nullable or not.
		onDelete: 'SET NULL' // Database cascade action on delete.
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	/**
	 * The organization contact ID associated with this payment.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Payment) => it.organizationContact)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationContactId?: ID;
	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Payment Tags
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => Tag, (it) => it.payments, {
		onUpdate: 'CASCADE', // Defines the database action to perform on update.
		onDelete: 'CASCADE', // Defines the database cascade action on delete.
		owner: true, // Defines the database relation as owner.
		pivotTable: 'tag_payment', // Defines the pivot table name.
		joinColumn: 'paymentId', // Defines the join column name.
		inverseJoinColumn: 'tagId' // Defines the inverse join column name.
	})
	@JoinTable({ name: 'tag_payment' })
	tags?: ITag[];
}
