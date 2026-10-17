import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { SubscriptionStatus } from '../../subscription.types';

/**
 * A subscription as a caller sees it.
 *
 * `status`, the period bounds, `nextBillingAt` and `billingCycleCount` are declared so a client can
 * read them, but every one of them is moved by a service decision rather than by a body: a caller
 * pauses, resumes, cancels or expires a subscription through the action endpoints, and the lifecycle
 * is what writes those columns.
 */
export class SubscriptionDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly planId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly originOrderId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly paymentAccountHolderId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly paymentMethodTokenId?: ID;

	@ApiPropertyOptional({ type: () => String, enum: SubscriptionStatus })
	@IsOptional()
	@IsEnum(SubscriptionStatus)
	readonly status?: SubscriptionStatus;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "1.000000".' })
	@IsOptional()
	@IsString()
	readonly quantity?: string;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly currentPeriodStart?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly currentPeriodEnd?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly nextBillingAt?: Date;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly billingCycleCount?: number;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly pausedUntil?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDate()
	readonly canceledAt?: Date;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly cancelReason?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
