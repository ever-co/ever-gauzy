import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrencyCode } from '@gauzy/contracts';
import { SubscriptionBillingPeriod } from '../../subscription.types';
import { SubscriptionPlanDTO } from './subscription-plan.dto';

/**
 * A plan as it is created.
 *
 * The three fields without which a plan cannot bill are required here and optional on the update
 * DTO: a name to call it, a code to key it by inside the organization, and the currency its amounts
 * are expressed in. Everything else has a defensible default — a monthly cadence, one interval, no
 * trial, no setup fee and no discount.
 */
export class CreateSubscriptionPlanDTO extends SubscriptionPlanDTO {
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly name: string;

	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly code: string;

	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	readonly currency: CurrencyCode;

	@ApiPropertyOptional({ type: () => String, enum: SubscriptionBillingPeriod })
	@IsOptional()
	@IsEnum(SubscriptionBillingPeriod)
	readonly billingPeriod?: SubscriptionBillingPeriod;
}
