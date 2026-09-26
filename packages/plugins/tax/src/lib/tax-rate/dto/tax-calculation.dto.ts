import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsArray,
	IsBoolean,
	IsDate,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Matches,
	MaxLength
} from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { TaxDirection } from '../../tax.types';

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

	/**
	 * The owner's quantity, as an exact decimal string; one when it is omitted.
	 *
	 * A fixed part of a rate contributes its amount per unit of this quantity, and the quantity is
	 * snapshotted on the tax line, so the evidence of a fixed tax is complete.
	 */
	@ApiPropertyOptional({ type: () => String, example: '3.000000' })
	@IsOptional()
	@IsString()
	@Matches(DECIMAL_STRING_PATTERN, { message: 'quantity must be an exact decimal string such as "3.000000"' })
	readonly quantity: DecimalString;

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

	/**
	 * The regime assigned to the party, when the caller resolved one. It always wins over the destination,
	 * and it is selected once for the whole document rather than once per line.
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
	 * The side of the document being taxed; a sale when it is omitted. A supplier bill is not taxed at the
	 * sales rates.
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

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly allowUntaxedCatalog: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly at: Date;
}
