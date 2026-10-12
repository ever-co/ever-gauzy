import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested
} from 'class-validator';
import { ID } from '@gauzy/contracts';
import { OrderReturnDTO } from './order-return.dto';

/**
 * One requested line, as a caller supplies it.
 *
 * The quantity is an exact decimal string, like every other quantity of the domain: the column behind
 * it is `numeric(20,6)` and a JSON number would lose the exactness on the way in.
 */
export class CreateOrderReturnLineInputDTO {
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
	@IsBoolean()
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

/**
 * A request to take goods back against an order.
 *
 * The number is allocated by the service from the `RETURN` series, so a caller never supplies one and
 * the values it may set are the order, the lines and where the goods should land.
 */
export class CreateOrderReturnDTO extends OrderReturnDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly orderId: ID;

	@ApiProperty({ type: () => [CreateOrderReturnLineInputDTO] })
	@IsNotEmpty()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => CreateOrderReturnLineInputDTO)
	readonly lines: CreateOrderReturnLineInputDTO[];

	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	readonly currency: string;
}
