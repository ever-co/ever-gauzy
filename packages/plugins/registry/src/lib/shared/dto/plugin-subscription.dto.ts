import {
	ID,
	PluginBillingPeriod,
	PluginScope,
	PluginSubscriptionStatus,
	PluginSubscriptionType
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
/**
 * Create Plugin Subscription DTO
 */
export class CreatePluginSubscriptionDTO {
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty({ message: 'Plugin ID is required' })
	@IsUUID(4, { message: 'Plugin ID must be a valid UUID' })
	pluginId: ID;

	@ApiProperty({ type: String, description: 'Subscription Plan ID' })
	@IsNotEmpty({ message: 'Subscription Plan ID is required' })
	@IsUUID(4, { message: 'Subscription Plan ID must be a valid UUID' })
	subscriptionPlanId: ID;

	@ApiProperty({ enum: PluginScope, description: 'Plugin scope' })
	@IsNotEmpty({ message: 'Scope is required' })
	@IsEnum(PluginScope, { message: 'Invalid plugin scope' })
	scope: PluginScope;

	@ApiProperty({ type: String, description: 'Plugin Tenant ID' })
	@IsNotEmpty({ message: 'Plugin Tenant ID is required' })
	@IsUUID(4, { message: 'Plugin Tenant ID must be a valid UUID' })
	pluginTenantId: ID;

	@ApiProperty({ enum: PluginSubscriptionStatus, description: 'Subscription status' })
	@IsNotEmpty({ message: 'Status is required' })
	@IsEnum(PluginSubscriptionStatus, { message: 'Invalid subscription status' })
	status: PluginSubscriptionStatus;

	@ApiPropertyOptional({ type: String, description: 'Subscription start date' })
	@IsOptional()
	@IsDateString({}, { message: 'Start date must be a valid date string' })
	startDate?: string;

	@ApiPropertyOptional({ type: String, description: 'Subscription end date' })
	@IsOptional()
	@IsDateString({}, { message: 'End date must be a valid date string' })
	endDate?: string;

	@ApiPropertyOptional({ type: String, description: 'Trial end date' })
	@IsOptional()
	@IsDateString({}, { message: 'Trial end date must be a valid date string' })
	trialEndDate?: string;

	@ApiProperty({ type: Boolean, description: 'Auto-renewal enabled' })
	@IsNotEmpty({ message: 'Auto renew setting is required' })
	@IsBoolean({ message: 'Auto renew must be a boolean' })
	autoRenew: boolean;

	@ApiPropertyOptional({ type: Object, description: 'Subscription metadata' })
	@IsOptional()
	@IsObject({ message: 'Metadata must be an object' })
	metadata?: Record<string, any>;
}

/**
 * Update Plugin Subscription DTO
 */
export class UpdatePluginSubscriptionDTO {
	@ApiPropertyOptional({ enum: PluginSubscriptionStatus, description: 'Subscription status' })
	@IsOptional()
	@IsEnum(PluginSubscriptionStatus, { message: 'Invalid subscription status' })
	status?: PluginSubscriptionStatus;

	@ApiPropertyOptional({ type: String, description: 'Subscription start date' })
	@IsOptional()
	@IsDateString({}, { message: 'Start date must be a valid date string' })
	startDate?: string;

	@ApiPropertyOptional({ type: String, description: 'Subscription end date' })
	@IsOptional()
	@IsDateString({}, { message: 'End date must be a valid date string' })
	endDate?: string;

	@ApiPropertyOptional({ type: String, description: 'Trial end date' })
	@IsOptional()
	@IsDateString({}, { message: 'Trial end date must be a valid date string' })
	trialEndDate?: string;

	@ApiPropertyOptional({ type: Boolean, description: 'Auto-renewal enabled' })
	@IsOptional()
	@IsBoolean({ message: 'Auto renew must be a boolean' })
	autoRenew?: boolean;

	@ApiPropertyOptional({ type: Object, description: 'Subscription metadata' })
	@IsOptional()
	@IsObject({ message: 'Metadata must be an object' })
	metadata?: Record<string, any>;
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

	@ApiPropertyOptional({ type: String, description: 'Plan ID' })
	@IsOptional()
	@IsUUID()
	planId?: string;

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
