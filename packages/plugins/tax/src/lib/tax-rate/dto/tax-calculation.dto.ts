import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';

/**
 * The exact-decimal shape a monetary input must have.
 */
const DECIMAL_STRING_PATTERN = /^-?\d{1,14}(\.\d{1,12})?$/;

/**
 * One line of a tax calculation.
 */
export class TaxCalculationLineDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly referenceId: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly taxCategoryId: ID;

	/**
	 * Net or gross amount of the line, as an exact decimal string; a JSON number is refused.
	 */
	@ApiProperty({ type: () => String, example: '49.980000' })
	@IsNotEmpty()
	@IsString()
	@Matches(DECIMAL_STRING_PATTERN, { message: 'amount must be an exact decimal string such as "49.980000"' })
	readonly amount: DecimalString;

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
}

/**
 * Compute tax for a set of amounts request DTO validation.
 */
export class TaxCalculationDTO {
	@ApiProperty({ type: () => String, example: 'USD' })
	@IsNotEmpty()
	@IsString()
	@Length(3, 3)
	readonly currency: CurrencyCode;

	@ApiProperty({ type: () => [TaxCalculationLineDTO] })
	@IsArray()
	readonly lines: TaxCalculationLineDTO[];

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

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly allowUntaxedCatalog: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly at: Date;
}
