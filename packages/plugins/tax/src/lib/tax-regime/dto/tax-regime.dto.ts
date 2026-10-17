import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDate,
	IsInt,
	IsNotEmpty,
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
 * Tax regime request DTO validation.
 *
 * The zone members are the same shape a rate's zone has, because a regime is matched on the same
 * destination. `priority` is optional in the body but is what makes an ambiguous match decidable, so the
 * service treats a missing one as the lowest priority rather than as "no preference".
 */
export class TaxRegimeDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly name: string;

	@ApiProperty({ type: () => String, example: 'DOMESTIC' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly code: string;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly priority: number;

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
	 * Whether the regime applies only when the party states a usable registration number. This is the
	 * condition that makes a reverse charge and an intra-community zero rate defensible.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly requiresPartyTaxRegistration: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly startsAt: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly endsAt: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly description: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}
