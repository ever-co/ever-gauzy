import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDate,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	MaxLength,
	Min
} from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Tax rate request DTO validation.
 *
 * The rate is given as a number because the column is `numeric(9,6)` read and written through the
 * platform's numeric transformer; every read side serialises it back to the fixed six-decimal string
 * the wire carries (`0.200000`), so a rate is never presented as a float.
 */
export class TaxRateDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
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
	@MaxLength(64)
	readonly postalCodePattern: string;

	/**
	 * The rate as a fraction — `0.2` is twenty percent, never `20`.
	 */
	@ApiProperty({ type: () => Number, example: 0.2 })
	@IsNotEmpty()
	@IsNumber({ maxDecimalPlaces: 6 })
	@Min(0)
	readonly rate: number;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isCompound: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isInclusive: boolean;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isDefault: boolean;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly priority: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly providerKey: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly startsAt: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly endsAt: Date;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}
