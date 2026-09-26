import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PriceListStatus, PriceListType } from '../../pricing.types';

/**
 * The mutable surface of a price list.
 *
 * Every field an operator may author is here exactly once, so the create, update and read shapes
 * cannot drift apart. The scope columns are the reason a list exists — a list with all of them null
 * applies to the whole organization — which is why they are authorable rather than derived.
 */
export class PriceListDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(255)
	readonly name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(64)
	readonly code: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	@ApiPropertyOptional({ type: () => String, enum: PriceListType, default: PriceListType.SALE })
	@IsOptional()
	@IsEnum(PriceListType)
	readonly type?: PriceListType;

	@ApiPropertyOptional({ type: () => String, enum: PriceListStatus, default: PriceListStatus.DRAFT })
	@IsOptional()
	@IsEnum(PriceListStatus)
	readonly status?: PriceListStatus;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly priority?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly channelId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerGroupId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly regionId?: ID;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly startsAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly endsAt?: Date;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isTaxInclusive?: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
