import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PricePreferenceAttribute } from '../../pricing.types';

/**
 * The mutable surface of a tax-inclusivity preference.
 *
 * Three fields, and that is the whole resource: what the preference is keyed by, which value of
 * that key it is for, and the answer. It is deliberately not folded into the currency or region
 * tables, because the same tenant presents the same catalogue differently per channel and the
 * channel table is not the pricing configuration's to extend.
 */
export class PricePreferenceDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String, enum: PricePreferenceAttribute })
	@IsEnum(PricePreferenceAttribute)
	readonly attribute: PricePreferenceAttribute;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(64)
	readonly value: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isTaxInclusive?: boolean;
}
