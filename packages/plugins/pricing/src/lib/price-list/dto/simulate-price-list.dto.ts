import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';

/**
 * A dry run of price resolution against a full context.
 *
 * Simulating is how an operator answers "what would this list do?" before activating it: the same
 * algorithm the storefront runs, given a context the caller states explicitly rather than one taken
 * from the caller's own session. Nothing is written, which is why the capability has its own
 * permission rather than borrowing the edit one.
 */
export class SimulatePriceListDTO {
	@ApiProperty({ type: () => Array })
	@IsArray()
	readonly variantIds: ID[];

	@ApiProperty({ type: () => String })
	readonly currency: CurrencyCode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly quantity?: DecimalString | number;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly date?: Date;

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
}
