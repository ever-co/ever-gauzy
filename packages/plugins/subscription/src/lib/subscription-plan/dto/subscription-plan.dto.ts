import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { SubscriptionBillingPeriod } from '../../subscription.types';

/**
 * A plan as a caller sees it.
 *
 * Amounts and fractions are strings, never numbers: `setupFee` and `discountPercentage` sit on exact
 * decimal columns and a JSON number would lose the exactness on the way in. `discountPercentage` is
 * a fraction, so ten per cent is `"0.100000"` — a percentage written as `10` is rejected rather than
 * guessed at.
 */
export class SubscriptionPlanDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly name?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly productId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiPropertyOptional({ type: () => String, enum: SubscriptionBillingPeriod })
	@IsOptional()
	@IsEnum(SubscriptionBillingPeriod)
	readonly billingPeriod?: SubscriptionBillingPeriod;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly billingInterval?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly maxBillingCycles?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly trialDays?: number;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "49.000000".' })
	@IsOptional()
	@IsString()
	readonly setupFee?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Fraction between 0 and 1, e.g. "0.100000".' })
	@IsOptional()
	@IsString()
	readonly discountPercentage?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isActive?: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}

/**
 * The plan code on its own, which is how a caller looks a plan up without knowing its id.
 */
export class SubscriptionPlanCodeDTO {
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code: string;
}
