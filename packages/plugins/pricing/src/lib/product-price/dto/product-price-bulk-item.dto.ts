import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { PriceStatus } from '../../pricing.types';

/**
 * One row of a bulk price matrix.
 *
 * The shape is deliberately narrower than the single-row create: a matrix import states what a
 * variant costs in a currency, optionally inside a list and a quantity band. Everything else about
 * the row is left to the service, so an import cannot silently change a guard rail that a merchant
 * set by hand.
 */
export class ProductPriceBulkItemDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly id?: ID;

	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly variantId: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly priceListId?: ID;

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
