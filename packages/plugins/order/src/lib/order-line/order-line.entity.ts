import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IOrderLine } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { MikroOrmOrderLineRepository } from './repository/mikro-orm-order-line.repository';

/**
 * One line of an order: what was bought, at the price it was bought at.
 *
 * Three groups of columns live here and none of them may be confused with another:
 *
 * - **Snapshots** — `title`, `sku`, `barcode`, `thumbnail`, `unitPrice`, `originalUnitPrice`,
 *   `isTaxInclusive`, `weight`. The customer bought a description at a price; renaming a product or
 *   editing a price list must not rewrite history.
 * - **Live references** — `productId`, `variantId`, `warehouseId`. Fulfilment, returns and exchanges
 *   resolve the current row, and a read falls back to the snapshot when the target is gone.
 * - **Caches of other rows** — the seven quantity counters. Each has exactly one derivation rule, and
 *   each is written in the same transaction as the row that causes it.
 */
@MultiORMEntity('order_line', { mikroOrmRepository: () => MikroOrmOrderLineRepository })
export class OrderLine extends TenantOrganizationBaseEntity implements IOrderLine {
	/** The order. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	orderId: ID;

	/** The product, kept for reporting and for the invoice bridge. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	productId?: ID;

	/** The sellable unit, resolved live by fulfilment, returns and exchanges. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	variantId?: ID;

	/**
	 * The seller whose offering the line was bought from, on a marketplace channel. Immutable once the
	 * order is placed: which seller is paid cannot change after the buyer agreed to the price.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	sellerId?: ID;

	/**
	 * The finance line this order line was flattened into by the order-to-invoice bridge. It lives here
	 * rather than as a new column on the core `invoice_item` table, so the core finance table is not
	 * modified and the reverse mapping stays owned by this package.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	invoiceItemId?: ID;

	/** Snapshot of the title at placement. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn()
	title: string;

	/** Snapshot of the SKU at placement. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 128 })
	sku?: string;

	/** Snapshot of the barcode, for picking and receiving. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	barcode?: string;

	/** Snapshot of the image URL at placement. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 1024 })
	thumbnail?: string;

	/** The ordered quantity. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	quantity: number;

	/** The price at placement. Never recomputed. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	unitPrice: number;

	/** The pre-discount price, kept so the order can explain its own discount. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	originalUnitPrice: number;

	/** Whether `unitPrice` is a gross. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/** A promotion may not discount this line when false. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	isDiscountable: boolean;

	/** A digital line never enters fulfilment. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	requiresShipping: boolean;

	/** The tax class. Live for a later return's computation, snapshotted in the tax lines for the applied tax. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	taxCategoryId?: ID;

	/** Snapshot of the weight, for carrier rating. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', precision: 12, scale: 4, transformer: new ColumnNumericTransformerPipe() })
	weight?: number;

	/** Display order. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/** A note about this line. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	note?: string;

	/** The location the line was allocated from. Fulfilment may re-allocate before shipping. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	warehouseId?: ID;

	/**
	 * The subscription the line originates from. The subscription package is installed after this one,
	 * so the column carries no constraint here.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	subscriptionId?: ID;

	/** Cache: the sum of the fulfilment lines referencing this line. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	fulfilledQuantity: number;

	/** Cache: the sum of the fulfilment lines whose fulfilment has shipped or gone further. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	shippedQuantity: number;

	/** Cache: the sum of the fulfilment lines whose fulfilment was delivered. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	deliveredQuantity: number;

	/** Cache: the sum of the non-rejected return lines. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	returnRequestedQuantity: number;

	/** Cache: the sum of the received return lines. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	returnReceivedQuantity: number;

	/** Cache: the sum of the dismissed return lines. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	returnDismissedQuantity: number;

	/** Cache: the sum of the written-off quantities. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0, transformer: new ColumnNumericTransformerPipe() })
	writtenOffQuantity: number;

	/** Open-ended payload: age limits, promotion codes, tax-rate codes and substitution notes. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The order. */
	@MultiORMManyToOne(() => Order, (it) => it.lines, { onDelete: 'CASCADE' })
	@JoinColumn()
	order?: Order;
}
