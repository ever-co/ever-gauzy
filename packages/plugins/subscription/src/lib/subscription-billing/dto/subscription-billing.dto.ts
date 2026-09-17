import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { SubscriptionBillingStatus } from '../../subscription.types';

/**
 * A billing cycle as a caller sees it.
 *
 * Everything except the amount, the currency and the two period bounds is written by the billing run
 * and the dunning policy rather than by a body: `attemptCount`, `lastError` and `nextRetryAt` are the
 * attempt history, and rewriting them by hand would make the history a claim rather than a record.
 */
export class SubscriptionBillingDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly subscriptionId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: ID;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly periodStart?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly periodEnd?: Date;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "120.000000".' })
	@IsOptional()
	@IsString()
	readonly amount?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String, enum: SubscriptionBillingStatus })
	@IsOptional()
	@IsEnum(SubscriptionBillingStatus)
	readonly status?: SubscriptionBillingStatus;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly dueAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly paidAt?: Date;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly attemptCount?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly lastError?: string;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly nextRetryAt?: Date;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
