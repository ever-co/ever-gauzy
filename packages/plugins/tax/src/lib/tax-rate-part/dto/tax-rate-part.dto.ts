import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	Length,
	MaxLength,
	Min
} from 'class-validator';
import { CurrencyCode } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { TaxAmountType, TaxPartType } from '../../tax.types';

/**
 * Tax rate part request DTO validation.
 *
 * A part is written as one element of its rate's ordered list rather than as a resource of its own, so the
 * rate is taken from the route and never from the body. The share is signed — a withholding is a part with
 * a negative share and a reverse charge is a positive and a negative part that net to zero — and the base
 * factor is what expresses a rate assessed on part of the value.
 */
export class TaxRatePartDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => Number, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly sequence: number;

	@ApiPropertyOptional({ type: () => String, enum: TaxPartType, default: TaxPartType.TAX })
	@IsOptional()
	@IsEnum(TaxPartType)
	readonly partType: TaxPartType;

	/**
	 * Signed share of the rate's computed amount this part carries, as a percentage of it: `100` carries
	 * the whole rate, `-100` reverses it, `5` carries a twentieth of it.
	 */
	@ApiProperty({ type: () => Number, example: 100 })
	@IsNotEmpty()
	@IsNumber({ maxDecimalPlaces: 6 })
	readonly factorPercent: number;

	/**
	 * Share of the owner's net-after-discount the part is computed on: `1` is the whole value and `0.5` is
	 * half of it, which is not the same thing as half the percentage.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 1 })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 6 })
	readonly baseFactor: number;

	@ApiPropertyOptional({ type: () => String, enum: TaxAmountType, default: TaxAmountType.PERCENT })
	@IsOptional()
	@IsEnum(TaxAmountType)
	readonly amountType: TaxAmountType;

	/**
	 * The amount a fixed part contributes per unit of the owner's quantity; non-null exactly when the part
	 * is a fixed one.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 6 })
	readonly fixedAmount: number;

	@ApiPropertyOptional({ type: () => String, example: 'USD' })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly fixedCurrency: CurrencyCode;

	/**
	 * The code the receiving accounting system posts this part under. Not an account: this platform holds
	 * no chart of accounts and mapping the code is the receiving system's job.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly postingKey: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly label: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}
