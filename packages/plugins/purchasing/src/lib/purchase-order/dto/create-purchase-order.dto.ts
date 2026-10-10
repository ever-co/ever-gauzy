import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested
} from 'class-validator';
import { ID } from '@gauzy/contracts';
import { PurchaseOrderDTO } from './purchase-order.dto';

/**
 * One ordered line, as a caller supplies it.
 *
 * Quantities and costs are exact decimal strings rather than numbers: the columns behind them are
 * `numeric(20,6)` and a JSON number would lose the exactness on the way in.
 *
 * **The cost may be omitted**, and then the standing agreement prices the line: the winning vendor term
 * first, then the variant's own cost price, and a clear refusal when neither exists — a line with no
 * price at all would post a zero-cost commitment. The unit may be stated too, for a supplier who sells
 * by the case while we stock eaches; the quantity is then in that unit and the conversion factor freezes
 * it.
 */
export class CreatePurchaseOrderLineInputDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "120.000000", in `unitId`.' })
	@IsNotEmpty()
	readonly quantity: string;

	@ApiPropertyOptional({ type: () => String, description: "The unit the quantity is stated in; the variant's purchase unit when omitted." })
	@IsOptional()
	@IsUUID()
	readonly unitId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Snapshot of the unit factor, e.g. "12.000000000000".' })
	@IsOptional()
	readonly conversionFactor?: string;

	@ApiPropertyOptional({
		type: () => String,
		description: 'Exact decimal price per base unit, e.g. "12.400000". Omit to price the line from the agreement.'
	})
	@IsOptional()
	readonly unitCost?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Fraction applied to the line total, e.g. "0.200000".' })
	@IsOptional()
	readonly taxRate?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal discount for this line.' })
	@IsOptional()
	readonly discountTotal?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly expectedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * A request to raise a purchase order against an existing supplier.
 *
 * The number is allocated by the service from the `PO` series, and the totals are derived from the
 * lines, so a caller states the supplier, the receiving location, the currency and what it wants.
 */
export class CreatePurchaseOrderDTO extends PurchaseOrderDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly vendorId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly warehouseId: ID;

	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	readonly currency: string;

	@ApiProperty({ type: () => [CreatePurchaseOrderLineInputDTO] })
	@IsNotEmpty()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => CreatePurchaseOrderLineInputDTO)
	readonly lines: CreatePurchaseOrderLineInputDTO[];
}
