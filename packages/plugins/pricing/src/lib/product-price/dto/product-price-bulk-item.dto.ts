import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { PriceBaseSource, PriceComputeMode, PriceStatus } from '../../pricing.types';

/**
 * One row of a bulk price matrix.
 *
 * The shape is deliberately narrower than the single-row create: a matrix import states what a
 * variant costs in a currency, optionally inside a list and a quantity band. Everything else about
 * the row is left to the service, so an import cannot silently change a guard rail that a merchant
 * set by hand.
 *
 * What a matrix import *does* state is how a row computes, because a price book is one of the things
 * a matrix is for: a distributor column is `list − 25 %` for every variant, and expressing that as N
 * materialised rows is exactly what the derivation replaces. `amount` is therefore optional, and
 * `variantId` is optional too, so a batch can write an open-scoped row.
 */
export class ProductPriceBulkItemDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly id?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly priceListId?: ID;

	@ApiProperty({ type: () => String })
	@IsString()
	@Length(3, 3)
	readonly currency: CurrencyCode;

	@ApiPropertyOptional({ type: () => String, description: 'The price, for a row that states one.' })
	@IsOptional()
	@IsString()
	readonly amount?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: PriceComputeMode })
	@IsOptional()
	@IsEnum(PriceComputeMode)
	readonly computeMode?: PriceComputeMode;

	@ApiPropertyOptional({ type: () => String, description: 'Signed fraction of the base.' })
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

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly roundTo?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly unitId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly minQuantity?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly maxQuantity?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: PriceStatus })
	@IsOptional()
	@IsEnum(PriceStatus)
	readonly status?: PriceStatus;
}
