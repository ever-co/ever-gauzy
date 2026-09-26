import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsDate,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested
} from 'class-validator';
import { ID } from '@gauzy/contracts';
import { GoodsReceiptDTO } from './goods-receipt.dto';

/**
 * One received line, as a caller supplies it.
 *
 * The good quantity and the damaged quantity are separate because they are two facts with two stock
 * consequences: the good units become sellable, the damaged ones are recorded and never sold. The
 * damaged quantity may be omitted, in which case nothing arrived broken.
 */
export class CreateGoodsReceiptLineInputDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly purchaseOrderLineId: ID;

	@ApiProperty({ type: () => String, description: 'Exact decimal good quantity, e.g. "8.000000".' })
	@IsNotEmpty()
	readonly quantity: string;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal damaged quantity, e.g. "1.000000".' })
	@IsOptional()
	readonly damagedQuantity?: string;

	@ApiPropertyOptional({
		type: () => String,
		description: 'Actual landed cost per unit; the order line cost is used when it is omitted.'
	})
	@IsOptional()
	readonly unitCost?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly batchNumber?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly expiresAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseBinId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * A request to receive goods against a purchase order.
 *
 * The order is optional: a consolidated delivery covering several orders states none, and neither does
 * goods that arrived with no order at all — the line's own order line is the authoritative relation.
 * The location may be omitted too, in which case the order's own location is used, and the service
 * refuses a location that differs from the location of the orders the lines belong to, because receiving
 * somewhere else is a transfer rather than a receipt.
 */
export class CreateGoodsReceiptDTO extends GoodsReceiptDTO {
	@ApiPropertyOptional({
		type: () => String,
		description: 'The order the delivery is anchored to. Every line has to belong to it when it is stated.'
	})
	@IsOptional()
	@IsUUID()
	readonly purchaseOrderId?: ID;

	@ApiPropertyOptional({
		type: () => String,
		description:
			'Fraction of the ordered quantity a line may be exceeded by, e.g. "0.050000" for five percent. The allowance the line\'s own term negotiated applies when it is omitted, then the organization\'s setting.'
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
