import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { DecimalString, ID } from '@gauzy/contracts';
import { PurchaseOrderLineDTO } from './purchase-order-line.dto';

/**
 * A line written on its own, outside the order's line set.
 *
 * The ordinary path writes lines as part of the order; this shape exists for the line controller, and
 * it is the only place a caller names the order a line belongs to. It is not a way to write a row
 * directly — it goes through the order's own validation, and the order's totals are rewritten with it.
 */
export class CreatePurchaseOrderLineDTO extends PurchaseOrderLineDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly purchaseOrderId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "120.000000", in `unitId`.' })
	@IsNotEmpty()
	readonly quantity: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'The unit the quantity is stated in.' })
	@IsOptional()
	@IsUUID()
	readonly unitId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Snapshot of the unit factor.' })
	@IsOptional()
	readonly conversionFactor?: DecimalString;

	@ApiPropertyOptional({
		type: () => String,
		description: 'Exact decimal price per base unit. Omit to price the line from the standing agreement.'
	})
	@IsOptional()
	readonly unitCost?: DecimalString;
}
