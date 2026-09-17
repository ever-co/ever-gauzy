import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { SubscriptionBillingDTO } from './subscription-billing.dto';

/**
 * A billing cycle as it is opened by hand.
 *
 * The billing run writes its own rows and this DTO exists for the one case the run cannot cover: a
 * backfill. The unique `(subscriptionId, periodStart)` key means a hand-written row and a scheduled
 * one cannot both exist for the same period, so a backfill cannot double-bill.
 */
export class CreateSubscriptionBillingDTO extends SubscriptionBillingDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly subscriptionId: ID;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsNotEmpty()
	@IsDate()
	readonly periodStart: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsNotEmpty()
	@IsDate()
	readonly periodEnd: Date;

	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "120.000000".' })
	@IsNotEmpty()
	@IsString()
	readonly amount: string;

	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	readonly currency: CurrencyCode;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly dueAt?: Date;
}
