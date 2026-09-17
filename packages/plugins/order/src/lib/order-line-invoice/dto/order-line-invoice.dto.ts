import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { OrderLineInvoiceDirection } from '../../order.types';

/**
 * The writable surface of one line-to-invoice link.
 *
 * The quantity is the one the item **actually billed**, never the line's ordered quantity: an item
 * that bills less is a partial invoice, which is exactly what this resource exists to express. The
 * amount is signed — negative for a credit — and the direction says which counter the quantity moves,
 * because a zero-value credit is legal and an unsigned zero cannot say which it is.
 *
 * `basisQuantity` is what the line is invoiced against. The invoice bridge reads it from the variant's
 * own `billingInvoicingPolicy` — the ordered quantity under a quantity-ordered policy, the fulfilled
 * quantity under a quantity-delivered one — and states it here so a line billed in two parts is judged
 * against the same basis both times.
 */
export class OrderLineInvoiceDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly orderLineId: ID;

	@ApiProperty({ type: () => String, description: 'The invoice item, or the credit-note item, this link records.' })
	@IsNotEmpty()
	@IsUUID()
	readonly invoiceItemId: ID;

	@ApiPropertyOptional({ type: () => String, enum: OrderLineInvoiceDirection })
	@IsOptional()
	@IsEnum(OrderLineInvoiceDirection)
	readonly direction?: OrderLineInvoiceDirection;

	@ApiProperty({ type: () => Number, description: 'The quantity the item actually billed, in the line’s unit.' })
	@IsNotEmpty()
	@IsNumber()
	readonly quantity: number;

	@ApiProperty({ type: () => Number, description: 'The signed amount the item carried; negative for a credit.' })
	@IsNotEmpty()
	@IsNumber()
	readonly amount: number;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Length(3, 3)
	readonly currency: CurrencyCode;

	@ApiPropertyOptional({
		type: () => Number,
		description: 'The quantity the line is invoiced against; the ordered quantity when omitted.'
	})
	@IsOptional()
	@IsNumber()
	readonly basisQuantity?: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
