import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PriceStatus } from '../../pricing.types';

/**
 * The mutable surface of one price row.
 *
 * `amount` is a decimal string rather than a number: the wire format of a money column is an exact
 * decimal, and accepting a float here is how a cent is lost between the caller and the column. The
 * same reason applies to the quantities a tier is bounded by and to the two guard-rail fractions.
 */
export class ProductPriceDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly priceListId?: ID;

	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly variantId: ID;

	@ApiProperty({ type: () => String })
	@IsString()
	@Length(3, 3)
	readonly currency: CurrencyCode;

	@ApiProperty({ type: () => String })
	@IsString()
	readonly amount: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly compareAtAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly costAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly minQuantity?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly maxQuantity?: DecimalString;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly taxInclusive?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly minMarginPercent?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly maxDiscountPercent?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: PriceStatus, default: PriceStatus.ACTIVE })
	@IsOptional()
	@IsEnum(PriceStatus)
	readonly status?: PriceStatus;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly startsAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly endsAt?: Date;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
