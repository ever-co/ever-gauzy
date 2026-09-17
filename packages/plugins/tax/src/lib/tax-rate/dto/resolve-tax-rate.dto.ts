import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * Resolve tax rate request DTO validation.
 *
 * The destination is the whole input: a rate is resolved for where a document is going, not for who is
 * buying it, so the customer's exemption is applied by the caller that owns the party data. The channel
 * the resolution happens in is taken from the request context rather than from the body.
 */
export class ResolveTaxRateDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly taxCategoryId: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly regionId: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Length(2, 2)
	readonly countryCode: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	readonly provinceCode: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly postalCode: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly regionTaxInclusive: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly at: Date;
}
