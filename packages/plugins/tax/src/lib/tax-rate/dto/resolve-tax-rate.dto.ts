import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TaxDirection } from '../../tax.types';

/**
 * Resolve tax rate request DTO validation.
 *
 * The destination and the party's tax identity are the whole input: a rate is resolved for where a document
 * is going and which tax set the party switches to, while the customer's exemption rules are applied by the
 * caller that owns the party data. The channel the resolution happens in is taken from the request context
 * rather than from the body.
 */
export class ResolveTaxRateDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly taxCategoryId: ID;

	/**
	 * The regime assigned to the party, when the caller resolved one. It always wins over the destination;
	 * when it is absent the most specific matching regime of the destination is selected.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly taxRegimeId: ID;

	/**
	 * Whether the party states a usable registration number, which a regime may require.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly partyTaxRegistrationPresent: boolean;

	/**
	 * The side of the document being taxed; a sale when it is omitted.
	 */
	@ApiPropertyOptional({ type: () => String, enum: TaxDirection, default: TaxDirection.SALE })
	@IsOptional()
	@IsEnum(TaxDirection)
	readonly documentDirection: TaxDirection;

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
	@IsDate()
	readonly at: Date;
}
