import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { SubscriptionItemDTO } from './subscription-item.dto';

/**
 * A recurring line as it is added.
 *
 * The subscription and the variant are required: a line that does not say which subscription it
 * bills, or which variant it delivers, is not a line. The quantity defaults to one and the price is
 * resolved when the caller does not state one.
 */
export class CreateSubscriptionItemDTO extends SubscriptionItemDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly subscriptionId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "2.000000".' })
	@IsOptional()
	@IsString()
	readonly quantity?: string;
}
