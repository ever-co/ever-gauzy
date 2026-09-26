import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The mutable surface of an exchange rate.
 *
 * `validFrom` is authorable rather than defaulted to now, because a rate is often entered for a
 * future value date — a contract that starts next month — and a rate entered for a past instant is
 * what makes a historical conversion reproducible.
 */
export class ExchangeRateDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	@Length(3, 3)
	readonly fromCurrency: CurrencyCode;

	@ApiProperty({ type: () => String })
	@IsString()
	@Length(3, 3)
	readonly toCurrency: CurrencyCode;

	@ApiProperty({ type: () => String })
	@IsString()
	readonly rate: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly providerKey?: string;

	@ApiProperty({ type: () => Date })
	@IsDateString()
	readonly validFrom: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly validUntil?: Date;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isManual?: boolean;
}
