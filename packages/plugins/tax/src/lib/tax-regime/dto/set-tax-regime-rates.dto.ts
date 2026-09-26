import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * Set which rates a regime selects request DTO validation.
 *
 * The set is written whole and may not be empty: a regime that selects nothing leaves every owner it
 * applies to untaxed, which is the one failure of this table that is both silent and expensive. Removing
 * a rate from a regime is a write of the set without it.
 */
export class SetTaxRegimeRatesDTO {
	@ApiProperty({ type: () => [String] })
	@IsArray()
	@ArrayNotEmpty()
	@IsUUID('4', { each: true })
	readonly taxRateIds: ID[];
}
