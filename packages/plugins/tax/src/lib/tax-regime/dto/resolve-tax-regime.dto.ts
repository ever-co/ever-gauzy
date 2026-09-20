import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * Resolve the regime that applies to a document request DTO validation.
 *
 * The party's own assignment is the first input and always wins; the destination is what is matched when
 * the party names none. The registration flag is what a regime that requires one tests, and it is part of
 * the request rather than something this capability looks up, because the party row belongs to the caller
 * that owns it.
 */
export class ResolveTaxRegimeDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly taxRegimeId: ID;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly partyTaxRegistrationPresent: boolean;

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

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly at: Date;
}
