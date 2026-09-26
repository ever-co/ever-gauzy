import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsDate,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested
} from 'class-validator';
import { ID } from '@gauzy/contracts';
import { CreateGoodsReceiptLineInputDTO } from '../../goods-receipt/dto';
import { PurchaseOrderDTO } from './purchase-order.dto';

/**
 * The body of `POST /purchase-orders/:id/send`.
 *
 * Sending is what tells the supplier the order exists and what makes the ordered quantities count as
 * incoming at the receiving location, so the message may be annotated and the recipient may be
 * overridden when the supplier's orders address is not the one on the vendor record.
 */
export class SendPurchaseOrderDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly email?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * The body of `POST /purchase-orders/:id/acknowledge`.
 *
 * A supplier that confirms an order often confirms it with a different date, so the acknowledgement
 * may revise the header's expected date. It never revises quantities: a supplier that cannot deliver
 * what was ordered is answered by receiving what does arrive and closing the order short.
 */
export class AcknowledgePurchaseOrderDTO {
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly expectedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * The body of `POST /purchase-orders/:id/approve`.
 *
 * Approval is recorded on the order rather than expressed as a status: an order that is waiting for a
 * decision is still a draft, and a refused approval has to leave it exactly where it was.
 */
export class ApprovePurchaseOrderDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** The body of `POST /purchase-orders/:id/cancel`. */
export class CancelPurchaseOrderDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly reason?: string;
}

/** The body of `POST /purchase-orders/:id/close`. */
export class ClosePurchaseOrderDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly reason?: string;
}

/** One line as an operator rewrites a draft order's line set. */
export class EditPurchaseOrderLineDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "120.000000", in `unitId`.' })
	@IsNotEmpty()
	readonly quantity: string;

	@ApiPropertyOptional({ type: () => String, description: 'The unit the quantity is stated in.' })
	@IsOptional()
	@IsUUID()
	readonly unitId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Snapshot of the unit factor.' })
	@IsOptional()
	readonly conversionFactor?: string;

	@ApiPropertyOptional({
		type: () => String,
		description: 'Exact decimal price per base unit. Omit to price the line from the standing agreement.'
	})
	@IsOptional()
	readonly unitCost?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Fraction applied to the line total.' })
	@IsOptional()
	readonly taxRate?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal discount for this line.' })
	@IsOptional()
	readonly discountTotal?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly expectedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * The body of `PUT /purchase-orders/:id`.
 *
 * Everything is optional and the service refuses the update once the order has left `DRAFT`. The
 * totals are never accepted from a caller: they are derived from the lines on every write, and so is
 * the due date, which follows from the settlement form the order runs on.
 */
export class EditPurchaseOrderDTO {
	@ApiPropertyOptional({ type: () => [EditPurchaseOrderLineDTO] })
	@IsOptional()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => EditPurchaseOrderLineDTO)
	readonly lines?: EditPurchaseOrderLineDTO[];

	@ApiPropertyOptional({ type: () => String, maxLength: 64, description: "The supplier's own order number." })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly vendorReference?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Who owns the order.' })
	@IsOptional()
	@IsUUID()
	readonly buyerUserId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'The settlement schedule the order runs on.' })
	@IsOptional()
	@IsUUID()
	readonly paymentTermId?: ID;

	@ApiPropertyOptional({ type: () => Number, description: 'The simple settlement form, in days.' })
	@IsOptional()
	@IsInt()
	readonly paymentTermsDaysSnapshot?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly expectedAt?: Date;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal freight charge for the whole order.' })
	@IsOptional()
	readonly shippingTotal?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * The body of `POST /purchase-orders/:id/receipts`.
 *
 * Receiving against the order path is the same operation as `POST /goods-receipts`; the path carries
 * the order so a caller that is already looking at one does not repeat it in the body. The location
 * and the received date are optional here because both are already on the order.
 */
export class ReceivePurchaseOrderDTO extends PurchaseOrderDTO {
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly receivedAt?: Date;

	@ApiPropertyOptional({
		type: () => String,
		description:
			'Fraction of the ordered quantity a line may be exceeded by, e.g. "0.050000" for five percent. Zero when omitted.'
	})
	@IsOptional()
	readonly overReceiptTolerance?: string;

	@ApiProperty({ type: () => [CreateGoodsReceiptLineInputDTO] })
	@IsNotEmpty()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => CreateGoodsReceiptLineInputDTO)
	readonly lines: CreateGoodsReceiptLineInputDTO[];
}
