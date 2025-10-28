import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Min
} from 'class-validator';
import { PluginSubscriptionPlan } from '../../domain/entities/plugin-subscription-plan.entity';
import { PluginBillingPeriod, PluginSubscriptionType } from '../../shared/models/plugin-subscription.model';

/**
 * Create Plugin Subscription Plan DTO
 */
export class CreatePluginSubscriptionPlanDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(PluginSubscriptionPlan, [
		'name',
		'description',
		'type',
		'price',
		'currency',
		'billingPeriod',
		'features',
		'limitations',
		'isActive',
		'isPopular',
		'isRecommended',
		'trialDays',
		'setupFee',
		'discountPercentage',
		'metadata',
		'sortOrder'
	] as const)
) {
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty()
	@IsUUID()
	pluginId: string;

	@ApiPropertyOptional({ type: String, description: 'User ID who created this plan' })
	@IsOptional()
	@IsUUID()
	createdById?: string;
}

/**
 * Update Plugin Subscription Plan DTO
 */
export class UpdatePluginSubscriptionPlanDTO extends PickType(PluginSubscriptionPlan, [
	'name',
	'description',
	'type',
	'price',
	'currency',
	'billingPeriod',
	'features',
	'limitations',
	'isActive',
	'isPopular',
	'isRecommended',
	'trialDays',
	'setupFee',
	'discountPercentage',
	'metadata',
	'sortOrder'
] as const) {}

/**
 * Plugin Subscription Plan Query DTO
 */
export class PluginSubscriptionPlanQueryDTO {
	@ApiPropertyOptional({ type: String, description: 'Plugin ID' })
	@IsOptional()
	@IsUUID()
	pluginId?: string;

	@ApiPropertyOptional({ enum: PluginSubscriptionType, description: 'Plan type' })
	@IsOptional()
	@IsEnum(PluginSubscriptionType)
	type?: PluginSubscriptionType;

	@ApiPropertyOptional({ enum: PluginBillingPeriod, description: 'Billing period' })
	@IsOptional()
	@IsEnum(PluginBillingPeriod)
	billingPeriod?: PluginBillingPeriod;

	@ApiPropertyOptional({ type: Boolean, description: 'Is plan active' })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;

	@ApiPropertyOptional({ type: Boolean, description: 'Is plan popular' })
	@IsOptional()
	@IsBoolean()
	isPopular?: boolean;

	@ApiPropertyOptional({ type: Boolean, description: 'Is plan recommended' })
	@IsOptional()
	@IsBoolean()
	isRecommended?: boolean;

	@ApiPropertyOptional({ type: Number, description: 'Minimum price filter' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	minPrice?: number;

	@ApiPropertyOptional({ type: Number, description: 'Maximum price filter' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	maxPrice?: number;

	@ApiPropertyOptional({ type: String, description: 'Currency filter' })
	@IsOptional()
	@IsString()
	currency?: string;

	@ApiPropertyOptional({ type: Boolean, description: 'Has trial filter' })
	@IsOptional()
	@IsBoolean()
	hasTrial?: boolean;
}

/**
 * Plugin Plan Features DTO
 */
export class PluginPlanFeaturesDTO {
	@ApiProperty({ type: [String], description: 'List of features' })
	@IsArray()
	@IsString({ each: true })
	features: string[];

	@ApiPropertyOptional({ type: Object, description: 'Feature limitations' })
	@IsOptional()
	@IsObject()
	limitations?: Record<string, any>;
}

/**
 * Plugin Plan Pricing DTO
 */
export class PluginPlanPricingDTO {
	@ApiProperty({ type: Number, description: 'Base price' })
	@IsNumber()
	@Min(0)
	price: number;

	@ApiProperty({ type: String, description: 'Currency code' })
	@IsNotEmpty()
	@IsString()
	currency: string;

	@ApiProperty({ enum: PluginBillingPeriod, description: 'Billing period' })
	@IsEnum(PluginBillingPeriod)
	billingPeriod: PluginBillingPeriod;

	@ApiPropertyOptional({ type: Number, description: 'Setup fee' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	setupFee?: number;

	@ApiPropertyOptional({ type: Number, description: 'Discount percentage' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	discountPercentage?: number;

	@ApiPropertyOptional({ type: Number, description: 'Trial period in days' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	trialDays?: number;
}

/**
 * Plugin Plan Bulk Operations DTO
 */
export class BulkPluginPlanOperationDTO {
	@ApiProperty({ type: [String], description: 'Plan IDs to operate on' })
	@IsArray()
	@IsUUID(4, { each: true })
	planIds: string[];

	@ApiProperty({ type: String, description: 'Operation type', enum: ['activate', 'deactivate', 'delete'] })
	@IsEnum(['activate', 'deactivate', 'delete'])
	operation: 'activate' | 'deactivate' | 'delete';
}

/**
 * Plugin Plan Copy DTO
 */
export class CopyPluginPlanDTO {
	@ApiProperty({ type: String, description: 'Source plan ID to copy from' })
	@IsNotEmpty()
	@IsUUID()
	sourcePlanId: string;

	@ApiProperty({ type: String, description: 'New plan name' })
	@IsNotEmpty()
	@IsString()
	newName: string;

	@ApiPropertyOptional({ type: String, description: 'New plan description' })
	@IsOptional()
	@IsString()
	newDescription?: string;

	@ApiPropertyOptional({ type: Number, description: 'New plan price' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	newPrice?: number;
}

/**
 * Plugin Plan Analytics DTO
 */
export class PluginPlanAnalyticsDTO {
	@ApiProperty({ type: String, description: 'Plan ID' })
	@IsNotEmpty()
	@IsUUID()
	planId: string;

	@ApiPropertyOptional({ type: String, description: 'Date range start (ISO string)' })
	@IsOptional()
	@IsString()
	dateFrom?: string;

	@ApiPropertyOptional({ type: String, description: 'Date range end (ISO string)' })
	@IsOptional()
	@IsString()
	dateTo?: string;

	@ApiPropertyOptional({ type: [String], description: 'Metrics to include' })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	metrics?: string[];
}
