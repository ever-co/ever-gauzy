import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { OrderReturnStatus } from '../../returns.types';

/**
 * A return as a caller sees it.
 *
 * Amounts are strings, never numbers: the columns behind them are exact decimals and a JSON number
 * would lose the exactness on the way in. `status`, `number` and every lifecycle timestamp are
 * service-owned and readable but not settable by a client.
 */
export class OrderReturnDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly number?: string;

	@ApiPropertyOptional({ type: () => String, enum: OrderReturnStatus })
	@IsOptional()
	@IsEnum(OrderReturnStatus)
	readonly status?: OrderReturnStatus;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly reasonId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly reason?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "125.000000".' })
	@IsOptional()
	@IsString()
	readonly refundAmount?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	readonly noNotification?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly shippingOptionId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly claimId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly exchangeId?: ID;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}

/**
 * The return number, as the service allocated it.
 */
export class OrderReturnNumberDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly number: string;
}
