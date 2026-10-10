import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { TaxRatePartDTO } from './tax-rate-part.dto';

/**
 * Replace the parts of a rate request DTO validation.
 *
 * The whole ordered list is written at once, because a breakdown is a set: adding a part changes the share
 * the other parts have to carry, and an endpoint that edited one element would leave the others summing to
 * something that is not the rate. An empty list is a legitimate write — it returns the rate to its one
 * implied part — so the list is required but may be empty.
 */
export class SetTaxRatePartsDTO {
	@ApiProperty({ type: () => [TaxRatePartDTO] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => TaxRatePartDTO)
	readonly parts: TaxRatePartDTO[];
}
