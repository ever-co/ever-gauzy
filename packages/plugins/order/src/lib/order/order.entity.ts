import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsEmail,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength
} from 'class-validator';
import { FulfillmentStatus, IOrder, ID, OrderStatus, OrderPaymentStatus } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { OrderAddress } from '../order-address/order-address.entity';
import { OrderChange } from '../order-change/order-change.entity';
import { OrderCreditLine } from '../order-credit-line/order-credit-line.entity';
import { OrderHistory } from '../order-history/order-history.entity';
import { OrderLine } from '../order-line/order-line.entity';
import { OrderShippingMethod } from '../order-shipping-method/order-shipping-method.entity';
import { OrderSummary } from '../order-summary/order-summary.entity';
import { OrderTransaction } from '../order-transaction/order-transaction.entity';
import { MikroOrmOrderRepository } from './repository/mikro-orm-order.repository';

/**
 * An order: the immutable commercial record.
 *
 * Once placed, nothing here is edited in place. `status`, the two materialised statuses, the totals and
 * the version move only through the paths that own them â€” `OrderStateMachine` for the lifecycle,
 * `OrderTotalsService` for the money, and an applied `order_change` for anything a person changes.
 * That is why every mutable-looking column on this entity is described as a cache of a ledger or of
 * the order's own lines.
 */
@MultiORMEntity('order', { mikroOrmRepository: () => MikroOrmOrderRepository })
export class Order extends TenantOrganizationBaseEntity implements IOrder {
	/**
	 * The human-facing number, allocated from the core `sequence` service with `key = 'ORDER'`.
	 *
	 * The sequence is the platform's numbering capability, not a counter of this package's own: it is
	 * gapless enough to be defensible in an audit, it is safe under concurrency, and every document a
	 * person quotes â€” a return, a purchase order, an invoice â€” is numbered by the same mechanism.
	 * Unique per organization and channel.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	number: string;

	/** A short, support-friendly form of the number. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	displayId?: string;

	/** The sales channel. Immutable after placement: it decides tax, rounding and reporting. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	channelId: ID;

	/** The commercial region, which drives tax and rounding. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	regionId?: ID;

	/**
	 * The buyer: an `organization_contact`, the row the platform already carries for a client, a
	 * customer or a lead. Null for a guest order, which is why the email is snapshotted below.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	customerId?: ID;

	/** The staff member who placed the order on the buyer's behalf. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	userId?: ID;

	/** Snapshot: the order stays contactable after the CRM record changes. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEmail()
	@MaxLength(255)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	email?: string;

	/** Snapshot of the contact's telephone number. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 32 })
	phone?: string;

	/** The currency every amount on the order is expressed in. Immutable once placed. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: string;

	/** Snapshot of the currency's decimal places, so historical rounding stays reproducible. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 2 })
	currencyDecimals: number;

	/** The buyer's locale at placement. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(10)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 10 })
	locale?: string;

	/** The lifecycle state. Only `OrderStateMachine` writes it. */
	@ApiProperty({ type: () => String, enum: OrderStatus })
	@IsEnum(OrderStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: OrderStatus, default: OrderStatus.DRAFT })
	status: OrderStatus;

	/**
	 * Materialised from the order's transaction ledger. **Never written by a caller**: it is derived
	 * from the ledger inside the same transaction that appends to it.
	 */
	@ApiProperty({ type: () => String, enum: OrderPaymentStatus })
	@IsEnum(OrderPaymentStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: OrderPaymentStatus, default: OrderPaymentStatus.NOT_PAID })
	paymentStatus: OrderPaymentStatus;

	/**
	 * Materialised from the fulfilment lines and their order-line quantities. Never written directly.
	 */
	@ApiProperty({ type: () => String, enum: FulfillmentStatus })
	@IsEnum(FulfillmentStatus)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: FulfillmentStatus,
		default: FulfillmentStatus.NOT_FULFILLED
	})
	fulfillmentStatus: FulfillmentStatus;

	/** A draft order is editable in place and has no reserved stock. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDraft: boolean;

	/** A test order is excluded from every report, from the ledger aggregates and from the invoice bridge. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTest: boolean;

	/** The cart the order was placed from. The cart package owns the cart; this column only records it. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	cartId?: ID;

	/** Self-reference for a subscription recurrence, which is the same concept at another point in time. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	parentOrderId?: ID;

	/** The accounting invoice produced by the order-to-invoice bridge. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	invoiceId?: ID;

	/** The estimate the order was converted from. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	quoteInvoiceId?: ID;

	/** How the order came into being: a channel, a staff member, a subscription, a quote, an import. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	source?: string;

	/** The frozen shipping address of the order. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	shippingAddressId?: ID;

	/** The frozen billing address of the order. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	billingAddressId?: ID;

	/**
	 * How many distinct sellers the lines resolve to, on a marketplace channel. Derived by the totals
	 * writer from the lines and never authored; zero on a single-seller order.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	sellerCount: number;

	/** Sum of the lines' net amounts before discount. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	itemSubtotal: number;

	/** Sum of the lines' discounts, as a positive magnitude. The ledger rows stay signed. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	itemDiscountTotal: number;

	/** Sum of the lines' tax lines. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	itemTaxTotal: number;

	/** Sum of the shipping methods' net amounts. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	shippingSubtotal: number;

	/** Sum of the shipping methods' discounts, as a positive magnitude. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	shippingDiscountTotal: number;

	/** Sum of the shipping methods' tax lines. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	shippingTaxTotal: number;

	/** `itemDiscountTotal + shippingDiscountTotal`. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	discountTotal: number;

	/** Equal to `itemTaxTotal`; the shipping tax is a column of its own. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	taxTotal: number;

	/**
	 * The tax-inclusive amount payable:
	 * `itemSubtotal - discountTotal + taxTotal + shippingSubtotal + shippingTaxTotal`.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	grandTotal: number;

	/** Materialised from the transaction ledger: settled money. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	paidTotal: number;

	/** Materialised from the transaction ledger, stored as a positive magnitude. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	refundedTotal: number;

	/** Sum of the credit lines of the current version. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	creditTotal: number;

	/** `grandTotal - creditTotal - paidTotal + refundedTotal`. A negative value means the buyer is owed. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	outstandingTotal: number;

	/**
	 * The optimistic lock and the totals-version pointer. Every committed write that alters order
	 * content increments it by one, and every increment writes one `order_summary` row.
	 */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

	/** When the order was placed. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	placedAt?: Date;

	/** When every line was fulfilled and the payment side settled. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	completedAt?: Date;

	/** When the order was cancelled. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/** Why the order was cancelled. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	cancelReason?: string;

	/**
	 * The buyer's own purchase-order reference, entered by a B2B buyer at checkout and printed on the
	 * invoice. It is a reference the customer supplies, not a procurement document of the tenant's.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	purchaseOrderNumber?: string;

	/** Open-ended payload: the approval request, credit-note invoices and the last validation warnings. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/** Key of this order in an upstream system. Unique per organization. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	externalId?: string;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** What was bought. */
	@MultiORMOneToMany(() => OrderLine, (it) => it.order, { onDelete: 'CASCADE' })
	lines?: OrderLine[];

	/** The frozen addresses. */
	@MultiORMOneToMany(() => OrderAddress, (it) => it.order, { onDelete: 'CASCADE' })
	addresses?: OrderAddress[];

	/** The delivery choices frozen on the order. */
	@MultiORMOneToMany(() => OrderShippingMethod, (it) => it.order, { onDelete: 'CASCADE' })
	shippingMethods?: OrderShippingMethod[];

	/** One row per totals version. */
	@MultiORMOneToMany(() => OrderSummary, (it) => it.order, { onDelete: 'CASCADE' })
	summaries?: OrderSummary[];

	/** The payment ledger. */
	@MultiORMOneToMany(() => OrderTransaction, (it) => it.order, { onDelete: 'CASCADE' })
	transactions?: OrderTransaction[];

	/** The post-placement modifications. */
	@MultiORMOneToMany(() => OrderChange, (it) => it.order, { onDelete: 'CASCADE' })
	changes?: OrderChange[];

	/** Money owed back to the buyer. */
	@MultiORMOneToMany(() => OrderCreditLine, (it) => it.order, { onDelete: 'CASCADE' })
	creditLines?: OrderCreditLine[];

	/** The order's own timeline. */
	@MultiORMOneToMany(() => OrderHistory, (it) => it.order, { onDelete: 'CASCADE' })
	history?: OrderHistory[];
}
