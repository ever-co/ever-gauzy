import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDateString,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Min
} from 'class-validator';
import { PluginSubscription } from '../../domain/entities/plugin-subscription.entity';
import { PluginScope } from '../../shared/models/plugin-scope.model';
import {
	PluginBillingPeriod,
	PluginSubscriptionStatus,
	PluginSubscriptionType
} from '../../shared/models/plugin-subscription.model';

/**
 * Create Plugin Subscription DTO
 */
export class CreatePluginSubscriptionDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(PluginSubscription, [
		'subscriptionType',
		'scope',
		'billingPeriod',
		'startDate',
		'endDate',
		'trialEndDate',
		'autoRenew',
		'metadata'
	] as const)
) {
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty()
	@IsUUID()
	pluginId: string;

	@ApiProperty({ type: String, description: 'Plugin Tenant ID' })
	@IsNotEmpty()
	@IsUUID()
	pluginTenantId: string;

	@ApiPropertyOptional({ type: String, description: 'Subscriber User ID' })
	@IsOptional()
	@IsUUID()
	subscriberId?: string;
}

/**
 * Update Plugin Subscription DTO
 */
export class UpdatePluginSubscriptionDTO extends PickType(PluginSubscription, [
	'subscriptionType',
	'billingPeriod',
	'endDate',
	'trialEndDate',
	'autoRenew',
	'cancelledAt',
	'cancellationReason',
	'metadata'
] as const) {
	@ApiPropertyOptional({ enum: PluginSubscriptionStatus, description: 'Subscription status' })
	@IsOptional()
	@IsEnum(PluginSubscriptionStatus)
	status?: PluginSubscriptionStatus;
}

/**
 * Plugin Subscription Query DTO
 */
export class PluginSubscriptionQueryDTO {
	@ApiPropertyOptional({ type: String, description: 'Plugin ID' })
	@IsOptional()
	@IsUUID()
	pluginId?: string;

	@ApiPropertyOptional({ type: String, description: 'Plugin Tenant ID' })
	@IsOptional()
	@IsUUID()
	pluginTenantId?: string;

	@ApiPropertyOptional({ type: String, description: 'Subscriber ID' })
	@IsOptional()
	@IsUUID()
	subscriberId?: string;

	@ApiPropertyOptional({ enum: PluginSubscriptionStatus, description: 'Subscription status' })
	@IsOptional()
	@IsEnum(PluginSubscriptionStatus)
	status?: PluginSubscriptionStatus;

	@ApiPropertyOptional({ enum: PluginSubscriptionType, description: 'Subscription type' })
	@IsOptional()
	@IsEnum(PluginSubscriptionType)
	subscriptionType?: PluginSubscriptionType;

	@ApiPropertyOptional({ enum: PluginScope, description: 'Subscription scope' })
	@IsOptional()
	@IsEnum(PluginScope)
	scope?: PluginScope;
}

/**
 * Purchase Plugin Subscription DTO
 */
export class PurchasePluginSubscriptionDTO {
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty()
	@IsUUID()
	pluginId: string;

	@ApiProperty({ enum: PluginSubscriptionType, description: 'Subscription type' })
	@IsEnum(PluginSubscriptionType)
	subscriptionType: PluginSubscriptionType;

	@ApiProperty({ enum: PluginBillingPeriod, description: 'Billing period' })
	@IsEnum(PluginBillingPeriod)
	billingPeriod: PluginBillingPeriod;

	@ApiProperty({ enum: PluginScope, description: 'Subscription scope' })
	@IsEnum(PluginScope)
	scope: PluginScope;

	@ApiProperty({ type: Boolean, description: 'Auto-renewal enabled' })
	@IsBoolean()
	autoRenew: boolean;

	@ApiPropertyOptional({ type: String, description: 'Payment method' })
	@IsOptional()
	@IsString()
	paymentMethod?: string;

	@ApiPropertyOptional({ type: String, description: 'Promo code' })
	@IsOptional()
	@IsString()
	promoCode?: string;

	@ApiPropertyOptional({ type: Object, description: 'Additional metadata' })
	@IsOptional()
	@IsObject()
	metadata?: Record<string, any>;
}

/**
 * Cancel Plugin Subscription DTO
 */
export class CancelPluginSubscriptionDTO {
	@ApiPropertyOptional({ type: String, description: 'Cancellation reason' })
	@IsOptional()
	@IsString()
	reason?: string;
}

/**
 * Renew Plugin Subscription DTO
 */
export class RenewPluginSubscriptionDTO {
	@ApiPropertyOptional({ enum: PluginBillingPeriod, description: 'New billing period' })
	@IsOptional()
	@IsEnum(PluginBillingPeriod)
	billingPeriod?: PluginBillingPeriod;

	@ApiPropertyOptional({ type: String, description: 'Payment method' })
	@IsOptional()
	@IsString()
	paymentMethod?: string;
}

/**
 * Plugin Access Check DTO
 */
export class PluginAccessCheckDTO {
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty()
	@IsUUID()
	pluginId: string;

	@ApiPropertyOptional({ type: String, description: 'Subscriber ID' })
	@IsOptional()
	@IsUUID()
	subscriberId?: string;
}

/**
 * Subscription Billing DTO
 */
export class SubscriptionBillingDTO {
	@ApiProperty({ type: Number, description: 'Billing amount' })
	@IsNumber()
	@Min(0)
	amount: number;

	@ApiProperty({ type: String, description: 'Currency code' })
	@IsNotEmpty()
	@IsString()
	currency: string;

	@ApiProperty({ type: String, description: 'Billing date' })
	@IsDateString()
	billingDate: string;

	@ApiPropertyOptional({ type: String, description: 'Payment method' })
	@IsOptional()
	@IsString()
	paymentMethod?: string;

	@ApiPropertyOptional({ type: String, description: 'Invoice URL' })
	@IsOptional()
	@IsString()
	invoiceUrl?: string;
}
