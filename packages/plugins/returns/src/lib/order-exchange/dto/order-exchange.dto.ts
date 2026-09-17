import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested
} from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { OrderExchangeStatus } from '../../returns.types';

/**
 * One outbound line of an exchange, as a caller supplies it.
 *
 * The replacement variant and the quantity are required; the price is resolved by the service and
 * snapshotted, because a caller that could name the price could name the difference the customer is
 * charged.
 */
export class CreateOrderExchangeLineInputDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderLineId?: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiProperty({ type: () => Number, minimum: 0, exclusiveMinimum: true })
	@IsNotEmpty()
	@IsNumber()
	@IsPositive()
	readonly quantity: number;

	@ApiPropertyOptional({
		type: () => String,
		description:
			'Exact decimal price of one replacement unit. Required when the replacement variant was not on the order and no price could be resolved from it.'
	})
	@IsOptional()
	@IsString()
	readonly unitPrice?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * An exchange as a caller sees it.
 */
export class OrderExchangeDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly number?: string;

	@ApiPropertyOptional({ type: () => String, enum: OrderExchangeStatus })
	@IsOptional()
	@IsEnum(OrderExchangeStatus)
	readonly status?: OrderExchangeStatus;

	@ApiPropertyOptional({
		type: () => String,
		description: 'Outbound value minus inbound value; exact decimal string, may be negative.'
	})
	@IsOptional()
	@IsString()
	readonly differenceDue?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly returnId?: ID;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly allowBackorder?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly metadata?: Record<string, unknown>;
}

/**
 * An exchange requested against a delivered order.
 */
export class CreateOrderExchangeDTO extends OrderExchangeDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly orderId: ID;

	@ApiProperty({ type: () => [CreateOrderExchangeLineInputDTO] })
	@IsNotEmpty()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => CreateOrderExchangeLineInputDTO)
	readonly lines: CreateOrderExchangeLineInputDTO[];

	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	readonly currency: string;
}
