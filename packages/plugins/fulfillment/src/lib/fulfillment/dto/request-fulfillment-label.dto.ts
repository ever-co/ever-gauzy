import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * What a caller states when it asks a carrier for a label.
 *
 * The strategy is required, because a label is issued by a carrier and this installation reaches
 * carriers through registered strategies: without a key there is nothing to ask. The service level is
 * not, because the fulfilment already records the one the shipment was sold at, and a caller that
 * requests the same label again has no reason to restate it.
 *
 * Nothing else is accepted. The parcel is the fulfilment the route names — its tracking number, its
 * carrier, its destination and its contents are the rows this domain already holds — so a body cannot
 * describe a shipment other than the one being labelled, and the DTO's whitelist refuses a field that
 * tries.
 */
export class RequestFulfillmentLabelDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly providerId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly service: string;
}
