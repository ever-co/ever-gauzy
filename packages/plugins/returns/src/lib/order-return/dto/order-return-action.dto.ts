import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	ValidateNested
} from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * One line as it is received back.
 *
 * `receivedQuantity` and `damagedQuantity` are separate because an item that arrives broken still
 * arrived: it is counted against the request, but it is written off rather than restocked, and the
 * difference between the two is what the stock ledger is told.
 */
export class ReceiveOrderReturnLineDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly lineId: ID;

	@ApiProperty({ type: () => Number, minimum: 0 })
	@IsNotEmpty()
	@IsNumber()
	readonly receivedQuantity: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 0, default: 0 })
	@IsOptional()
	@IsNumber()
	readonly damagedQuantity?: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	readonly restock?: boolean;
}

/** The body of `POST /order-returns/:id/receive`. */
export class ReceiveOrderReturnDTO {
	@ApiProperty({ type: () => [ReceiveOrderReturnLineDTO] })
	@IsNotEmpty()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => ReceiveOrderReturnLineDTO)
	readonly lines: ReceiveOrderReturnLineDTO[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({
		type: () => String,
		description: 'Exact decimal refund to issue once the goods are in; omitted when nothing is refunded.'
	})
	@IsOptional()
	@IsString()
	readonly refund?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** The body of `POST /order-returns/:id/refund`. */
export class RefundOrderReturnDTO {
	@ApiProperty({ type: () => String, description: 'Exact decimal amount to refund.' })
	@IsNotEmpty()
	@IsString()
	readonly amount: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly reasonId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** The body of `POST /order-returns/:id/shipping`. */
export class ShipOrderReturnDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly shippingOptionId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly trackingNumber?: string;
}

/** The body of every action that only needs a reason. */
export class ReasonedOrderReturnActionDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly reason?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** One line as an operator edits a return's line set. */
export class EditOrderReturnLineDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly orderLineId: ID;

	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "2.000000".' })
	@IsNotEmpty()
	readonly quantity: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly reasonId?: ID;

	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@IsOptional()
	readonly restock?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/** The body of `PUT /order-returns/:id`, when the caller replaces the line set. */
export class EditOrderReturnDTO {
	@ApiPropertyOptional({ type: () => [EditOrderReturnLineDTO] })
	@IsOptional()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => EditOrderReturnLineDTO)
	readonly lines?: EditOrderReturnLineDTO[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly reason?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}
