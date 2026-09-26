import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PriceBaseSource, PriceComputeMode, PriceStatus } from '../../pricing.types';

/**
 * The mutable surface of one price row.
 *
 * `amount` is a decimal string rather than a number: the wire format of a money column is an exact
 * decimal, and accepting a float here is how a cent is lost between the caller and the column. The
 * same reason applies to the quantities a tier is bounded by and to the two guard-rail fractions.
 *
 * `amount` is optional and `computeMode` says why: a row either **is** a price or says **how** to
 * compute one, and the two are mutually exclusive — a row that stated both would leave every consumer
 * to choose, and the resolver, the invoice bridge and an export would not all choose the same one. A
 * derived row states `percent` and `baseSource` instead, and `basePriceListId` when its base is
 * another list.
 *
 * `variantId` is optional too. A row without one is **open-scoped**: its applicability is exactly its
 * `rule` rows with `ownerType = PRICE`, which is how one row prices a whole category, a tag or a
 * collection instead of every variant in it.
 */
export class ProductPriceDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly priceListId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiProperty({ type: () => String })
	@IsString()
	@Length(3, 3)
	readonly currency: CurrencyCode;

	@ApiPropertyOptional({ type: () => String, description: 'The price, for a row that states one.' })
	@IsOptional()
	@IsString()
	readonly amount?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: PriceComputeMode, default: PriceComputeMode.AMOUNT })
	@IsOptional()
	@IsEnum(PriceComputeMode)
	readonly computeMode?: PriceComputeMode;

	@ApiPropertyOptional({ type: () => String, description: 'Signed fraction of the base: 0.25 is 25 % off.' })
	@IsOptional()
	@IsString()
	readonly percent?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: PriceBaseSource })
	@IsOptional()
	@IsEnum(PriceBaseSource)
	readonly baseSource?: PriceBaseSource;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly basePriceListId?: ID;

	@ApiPropertyOptional({
		type: () => String,
		description: 'The multiple the derived amount is rounded to, before the currency rounding boundary.'
	})
	@IsOptional()
	@IsString()
	readonly roundTo?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'The unit the quantity bounds are expressed in.' })
	@IsOptional()
	@IsUUID()
	readonly unitId?: ID;

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
