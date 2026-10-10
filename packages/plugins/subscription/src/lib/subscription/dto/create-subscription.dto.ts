import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { SubscriptionDTO } from './subscription.dto';

/**
 * One recurring line as a caller supplies it.
 *
 * `unitPrice` is optional on purpose: when it is omitted the price is resolved through the ordinary
 * pricing pipeline, which is what makes a customer price list reach a subscription the same way it
 * reaches a one-off order. A stated price is a snapshot the caller takes responsibility for.
 */
export class SubscriptionItemInputDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly variantId: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "2.000000".' })
	@IsOptional()
	@IsString()
	readonly quantity?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "19.990000".' })
	@IsOptional()
	@IsString()
	readonly unitPrice?: string;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	readonly position?: number;
}

/**
 * A request to put a customer on a plan.
 *
 * The plan and the customer are the only required fields: the item set is derived from the plan's
 * catalogue target when the caller names none, and the period bounds are computed from the plan's
 * cadence. Naming the originating order is what makes the request idempotent — a retried checkout
 * finds the subscription it already created instead of making a second one.
 */
export class CreateSubscriptionDTO extends SubscriptionDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly planId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly customerId: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly originOrderId?: ID;

	@ApiPropertyOptional({ type: () => [SubscriptionItemInputDTO] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SubscriptionItemInputDTO)
	readonly items?: SubscriptionItemInputDTO[];

	@ApiPropertyOptional({
		type: () => Boolean,
		default: false,
		description: 'Bill the first period as part of creation instead of leaving the subscription pending.'
	})
	@IsOptional()
	@IsBoolean()
	readonly activate?: boolean;

	@ApiPropertyOptional({
		type: () => Boolean,
		default: false,
		description: 'Leave the subscription inside the plan trial rather than billing the first period.'
	})
	@IsOptional()
	@IsBoolean()
	readonly startTrial?: boolean;
}
