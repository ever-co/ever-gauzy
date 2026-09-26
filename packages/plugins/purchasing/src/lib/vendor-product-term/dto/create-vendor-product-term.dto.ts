import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { VendorProductTermDTO } from './vendor-product-term.dto';

/**
 * A term as a caller writes it.
 *
 * The supplier and the variant are the two things a term cannot mean anything without. The price may
 * be stated either way a supplier states it — per base unit, or as the price of their container — and
 * the service derives the per-unit figure from the pair, rounded half-up, so the platform's own total
 * stays authoritative whichever form the quote arrived in. The currency is defaulted by the service
 * from the supplier's own purchase currency and then from the organization's base currency, because a
 * price without its currency is not a price.
 */
export class CreateVendorProductTermDTO extends VendorProductTermDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly vendorId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiPropertyOptional({
		type: () => String,
		description: 'Exact decimal price for one base unit, e.g. "4.200000". State this or a pack price.'
	})
	@IsOptional()
	readonly unitCost?: string;

	@ApiPropertyOptional({
		type: () => String,
		description: 'The price of the supplier container, e.g. "10.800000" for a case of twelve.'
	})
	@IsOptional()
	readonly packPrice?: string;
}

/**
 * One request that writes several terms at once.
 *
 * A product-wide agreement is written as one row per variant: a term with no variant is deliberately
 * not supported, and the answer to a catalogue too large to write by hand is this operation rather
 * than a second resolution path that would need its own precedence rule.
 */
export class BulkVendorProductTermDTO {
	@ApiProperty({ type: () => [CreateVendorProductTermDTO] })
	@IsNotEmpty()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => CreateVendorProductTermDTO)
	readonly terms: CreateVendorProductTermDTO[];
}
