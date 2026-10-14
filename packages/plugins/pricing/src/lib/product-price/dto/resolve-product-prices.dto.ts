import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';

/**
 * Effective price request validation.
 *
 * The caller states the context it wants priced — the variants, the quantity, and as much of the
 * channel, region, customer and instant as it knows. Anything it omits is treated as unconstrained,
 * which is what makes the same endpoint serve both a product page (one variant, quantity one) and a
 * cart preview (many variants, a customer with groups).
 */
export class ResolveProductPricesDTO {
	@ApiProperty({ type: () => Array })
	@IsArray()
	readonly variantIds: ID[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly quantity?: DecimalString | number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly channelId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly regionId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerId?: ID;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	readonly customerGroupIds?: ID[];

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly date?: Date;
}
