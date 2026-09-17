import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
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
import { OrderClaimReason, OrderClaimStatus, OrderClaimType } from '../../returns.types';

/**
 * One claimed line, as a caller supplies it.
 *
 * A line names an order line (something that was on the order) or a variant on its own (a replacement
 * part the customer never ordered); the service requires exactly one of the two, which is what
 * `isAdditionalItem` is derived from rather than trusted.
 */
export class CreateOrderClaimLineInputDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderLineId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiProperty({ type: () => Number, minimum: 0, exclusiveMinimum: true })
	@IsNotEmpty()
	@IsNumber()
	@IsPositive()
	readonly quantity: number;

	@ApiPropertyOptional({ type: () => String, enum: OrderClaimReason })
	@IsOptional()
	@IsEnum(OrderClaimReason)
	readonly reason?: OrderClaimReason;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	readonly isAdditionalItem?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;
}

/**
 * A claim as a caller sees it.
 */
export class OrderClaimDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly number?: string;

	@ApiPropertyOptional({ type: () => String, enum: OrderClaimType })
	@IsOptional()
	@IsEnum(OrderClaimType)
	readonly type?: OrderClaimType;

	@ApiPropertyOptional({ type: () => String, enum: OrderClaimStatus })
	@IsOptional()
	@IsEnum(OrderClaimStatus)
	readonly status?: OrderClaimStatus;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "50.000000".' })
	@IsOptional()
	@IsString()
	readonly refundAmount?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly returnId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly metadata?: Record<string, unknown>;
}

/**
 * A claim raised by a customer or an operator.
 */
export class CreateOrderClaimDTO extends OrderClaimDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly orderId: ID;

	@ApiProperty({ type: () => [CreateOrderClaimLineInputDTO] })
	@IsNotEmpty()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => CreateOrderClaimLineInputDTO)
	readonly lines: CreateOrderClaimLineInputDTO[];

	@ApiProperty({ type: () => String, enum: OrderClaimType })
	@IsNotEmpty()
	@IsEnum(OrderClaimType)
	readonly type: OrderClaimType;

	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	readonly currency: string;
}
