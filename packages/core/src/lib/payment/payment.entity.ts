import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	MaxLength
} from 'class-validator';
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
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne
} from './../core/decorators/entity';
import { PaymentStatusDetail } from '../core/enums/kernel-extension.enums';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MikroOrmPaymentRepository } from './repository/mikro-orm-payment.repository';

/**
 * One row per money movement, whichever document it settles.
 *
 * A provider-backed payment against an order is the same fact the finance services already record
 * against an invoice, an expense or a project — a second table for it would make "how much has been
 * paid" a question with two answers. The four lifecycle amounts live here for the same reason: the
 * lifecycle state is derived from them on this row and can never disagree with itself.
 *
 * The document references (`orderId`, `paymentCollectionId`, `paymentSessionId`,
 * `paymentProviderId`) are carried as the queryable columns **without** their foreign keys, because
 * the tables they name are created by the payment package's own set, which adds the constraints once
 * they exist.
 */
@ColumnIndex('IDX_payment_order', ['orderId', 'status'], { where: '"orderId" IS NOT NULL AND "deletedAt" IS NULL' })
@ColumnIndex('IDX_payment_collection', ['paymentCollectionId', 'status'], {
	where: '"paymentCollectionId" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_payment_provider', ['paymentProviderId', 'status'], { where: '"paymentProviderId" IS NOT NULL' })
@ColumnIndex('IDX_payment_session', ['paymentSessionId'], { where: '"paymentSessionId" IS NOT NULL' })
@ColumnIndex('IDX_payment_org_created', ['organizationId', 'createdAt'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('UQ_payment_external', ['paymentProviderId', 'externalId'], {
	unique: true,
	where: '"externalId" IS NOT NULL AND "paymentProviderId" IS NOT NULL AND "deletedAt" IS NULL'
})
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

	/**
	 * The order this payment settles; null for a payment recorded against an invoice, an expense or a
	 * project instead.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	orderId?: ID;

	/**
	 * The collection this payment belongs to, when it came from a checkout.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	paymentCollectionId?: ID;

	/**
	 * The session that produced it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	paymentSessionId?: ID;

	/**
	 * The provider that processed it; null for a manual or offline payment.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	paymentProviderId?: ID;

	/**
	 * The lifecycle state of the money movement, derived from the four amounts below and the capture
	 * and refund rows, never set directly by a caller.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentStatusDetail, default: PaymentStatusDetail.CAPTURED })
	@IsEnum(PaymentStatusDetail)
	@MultiORMColumn({ type: 'simple-enum', enum: PaymentStatusDetail, default: PaymentStatusDetail.CAPTURED })
	status?: PaymentStatusDetail;

	/**
	 * The provider's charge id; with `paymentProviderId` it is the key a repeated provider callback
	 * collides on, so a duplicate callback cannot create a second payment.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	/**
	 * Human reference printed on the statement or handed to the customer.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	reference?: string;

	/**
	 * Amount the provider authorised. Null for a manual payment, which has no authorisation step.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	authorizedAmount?: number;

	/**
	 * Amount actually captured. For a provider-backed payment the service keeps it equal to `amount`
	 * once the row reaches `CAPTURED`, so the accounting figure and the provider figure cannot
	 * disagree.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	capturedAmount?: number;

	/**
	 * Amount refunded against this payment.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	refundedAmount?: number;

	/**
	 * Amount of the authorisation released without capture.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	canceledAmount?: number;

	/**
	 * The currency the provider settles this payment in. Null means settlement is in the payment's own
	 * currency, which is the ordinary case.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	settlementCurrency?: string;

	/**
	 * The amount settled, in `settlementCurrency`; null when `settlementCurrency` is null. It is set
	 * once, when the capture settles, and never recomputed.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	settlementAmount?: number;

	/**
	 * The rate applied at settlement: one unit of the payment's currency equals `fxRate` units of
	 * `settlementCurrency`. It is a snapshot and is never re-derived from the exchange-rate table, so a
	 * later rate change cannot rewrite what was settled.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 10,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	fxRate?: number;

	/**
	 * The exchange-rate row the rate was read from, when it came from one; null for an identity
	 * conversion and for a rate a provider quoted. **No foreign key on purpose**: the payment keeps its
	 * own snapshot, so a rate row reaching its retention date must never block or rewrite a settled
	 * payment.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	fxRateId?: ID;

	/**
	 * The instant the rate was taken, which is the instant the lookups ran.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	fxCapturedAt?: Date;

	/**
	 * When the authorisation was taken.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	authorizedAt?: Date;

	/**
	 * When the capture settled.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	capturedAt?: Date;

	/**
	 * When the authorisation was released.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/**
	 * Provider response fragments, card brand and last four, reconciliation notes.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

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
