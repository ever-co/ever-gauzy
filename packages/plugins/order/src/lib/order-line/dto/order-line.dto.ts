import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDateString,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	MaxLength
} from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { OrderLineKind } from '../../order.types';

/**
 * The writable surface of an order line.
 *
 * The seven quantity counters are absent on purpose: each is a cache of the fulfilment, return or
 * write-off rows that cause it, and a caller that could set one could make the order disagree with the
 * shipments that justify it. The four invoicing registers — `invoicedQuantity`, `creditedQuantity`,
 * `invoiceStatus` and `refundedQuantity` / `refundedAmount` — are absent for the same reason: they are
 * the sum of the `order_line_invoice` and `refund_line` rows, and the route that writes them is
 * `/order-line-invoices`, which moves the register and its evidence together.
 *
 * `unitPrice` **is** accepted because a draft order may be priced by hand; a placed order's price is
 * only ever changed through an `ITEM_UPDATE` action. `kind` is accepted because a quotation's heading
 * is authored rather than derived, and `promisedAt` with its `leadTimeDays` because a promise is a
 * decision a person makes — moving one afterwards is an order change, so the customer sees the move.
 */
export class OrderLineDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly productId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly sellerId: string;

	@ApiPropertyOptional({ type: () => String, enum: OrderLineKind })
	@IsOptional()
	@IsEnum(OrderLineKind)
	readonly kind?: OrderLineKind;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly title: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly promisedAt?: Date;

	@ApiPropertyOptional({ type: () => Number, description: 'The lead time the promise was computed from.' })
	@IsOptional()
	@IsInt()
	readonly leadTimeDays?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly sku: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly barcode: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	readonly thumbnail: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	readonly quantity: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly unitPrice: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly originalUnitPrice: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTaxInclusive: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isDiscountable: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly requiresShipping: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly taxCategoryId: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly weight: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly position: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly subscriptionId: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}

/**
 * One refund as the payment side records it against a line.
 *
 * Both members are positive magnitudes: the direction is the refund itself, not a sign, and a negative
 * quantity would be a second way to say the same thing — one of which the reconciliation would have to
 * guess at.
 */
export class RecordOrderLineRefundDTO {
	@ApiProperty({ type: () => Number, description: 'The quantity paid back, as a positive magnitude.' })
	@IsNotEmpty()
	@IsNumber()
	readonly quantity: number;

	@ApiProperty({ type: () => Number, description: 'The money paid back, in the order currency, as a positive magnitude.' })
	@IsNotEmpty()
	@IsNumber()
	readonly amount: number;

	@ApiProperty({ type: () => String, description: 'The order currency; checked against the order the line belongs to.' })
	@IsNotEmpty()
	@IsString()
	@Length(3, 3)
	readonly currency: string;
}
