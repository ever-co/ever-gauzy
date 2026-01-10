import { CurrenciesEnum, ID, PluginBillingPeriod, PluginSubscriptionType } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
	MaxLength,
	Min
} from 'class-validator';

/**
 * Helper function to transform string to boolean
 */
const transformToBoolean = ({ value }: { value: any }): boolean | undefined => {
	if (value === 'true' || value === true) return true;
	if (value === 'false' || value === false) return false;
	if (value === '1' || value === 1) return true;
	if (value === '0' || value === 0) return false;
	return value;
};

/**
 * Helper function to transform string to number (optional)
 */
const transformToOptionalNumber = ({ value }: { value: any }): number | undefined => {
	if (value === '' || value === null || value === undefined) return undefined;
	return Number(value);
};

/**
 * Base class for subscription plan fields with transformations
 */
class BaseSubscriptionPlanFieldsDTO {
	@ApiProperty({ type: Number, description: 'Plan price' })
	@IsNotEmpty({ message: 'Price is required' })
	@IsNumber({}, { message: 'Price must be a valid number' })
	@Min(0, { message: 'Price cannot be negative' })
	@Type(() => Number)
	price: number;

	@ApiPropertyOptional({ type: Boolean, description: 'Whether this plan is marked as popular' })
	@IsOptional()
	@IsBoolean({ message: 'isPopular must be a boolean' })
	@Transform(transformToBoolean)
	isPopular?: boolean;

	@ApiPropertyOptional({ type: Boolean, description: 'Whether this plan is recommended' })
	@IsOptional()
	@IsBoolean({ message: 'isRecommended must be a boolean' })
	@Transform(transformToBoolean)
	isRecommended?: boolean;

	@ApiPropertyOptional({ type: Number, description: 'Trial period duration in days' })
	@IsOptional()
	@IsNumber({}, { message: 'Trial days must be a number' })
	@Min(0, { message: 'Trial days cannot be negative' })
	@Type(() => Number)
	@Transform(transformToOptionalNumber)
	trialDays?: number;

	@ApiPropertyOptional({ type: Number, description: 'Setup fee for the plan' })
	@IsOptional()
	@IsNumber({}, { message: 'Setup fee must be a number' })
	@Min(0, { message: 'Setup fee cannot be negative' })
	@Type(() => Number)
	@Transform(transformToOptionalNumber)
	setupFee?: number;

	@ApiPropertyOptional({ type: Number, description: 'Discount percentage for the plan' })
	@IsOptional()
	@IsNumber({}, { message: 'Discount percentage must be a number' })
	@Min(0, { message: 'Discount percentage cannot be negative' })
	@Type(() => Number)
	@Transform(transformToOptionalNumber)
	discountPercentage?: number;
}

/**
 * Create Plugin Subscription Plan DTO
 */
export class CreatePluginSubscriptionPlanDTO extends BaseSubscriptionPlanFieldsDTO {
	@ApiProperty({ type: String, description: 'Plan name' })
	@IsNotEmpty({ message: 'Plan name is required' })
	@IsString({ message: 'Name must be a string' })
	@MaxLength(255, { message: 'Name cannot exceed 255 characters' })
	name: string;

	@ApiPropertyOptional({ type: String, description: 'Plan description' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	description?: string;

	@ApiProperty({ enum: PluginSubscriptionType, description: 'Plan type' })
	@IsNotEmpty({ message: 'Plan type is required' })
	@IsEnum(PluginSubscriptionType, { message: 'Invalid plan type' })
	type: PluginSubscriptionType;

	@ApiProperty({ enum: CurrenciesEnum, description: 'Plan currency' })
	@IsNotEmpty({ message: 'Currency is required' })
	@IsEnum(CurrenciesEnum, { message: 'Invalid currency' })
	currency: CurrenciesEnum;

	@ApiProperty({ enum: PluginBillingPeriod, description: 'Billing period' })
	@IsNotEmpty({ message: 'Billing period is required' })
	@IsEnum(PluginBillingPeriod, { message: 'Invalid billing period' })
	billingPeriod: PluginBillingPeriod;

	@ApiProperty({ type: [String], description: 'Plan features' })
	@IsNotEmpty({ message: 'Features are required' })
	@IsArray({ message: 'Features must be an array' })
	@IsString({ each: true, message: 'Each feature must be a string' })
	features: string[];

	@ApiPropertyOptional({ type: Object, description: 'Plan limitations' })
	@IsOptional()
	@IsObject({ message: 'Limitations must be an object' })
	limitations?: Record<string, any>;

	@ApiPropertyOptional({ type: Boolean, description: 'Is plan active' })
	@IsOptional()
	@IsBoolean({ message: 'IsActive must be a boolean' })
	@Transform(transformToBoolean)
	isActive: boolean;

	@ApiPropertyOptional({ type: Object, description: 'Plan metadata' })
	@IsOptional()
	@IsObject({ message: 'Metadata must be an object' })
	metadata?: Record<string, any>;

	@ApiPropertyOptional({ type: Number, description: 'Sort order' })
	@IsOptional()
	@IsNumber({}, { message: 'Sort order must be a number' })
	@Type(() => Number)
	@Transform(transformToOptionalNumber)
	sortOrder?: number;

	@ApiPropertyOptional({ type: String, description: 'Plugin ID' })
	@IsUUID(4, { message: 'Plugin ID must be a valid UUID' })
	@IsOptional()
	pluginId?: ID;
}

/**
 * Update Plugin Subscription Plan DTO
 */
export class UpdatePluginSubscriptionPlanDTO {
	@ApiProperty({
		description: 'Unique identifier for the plugin',
		example: '123e4567-e89b-12d3-a456-426614174000'
	})
	@IsUUID('4', { message: 'The plugin ID must be a valid UUID v4' })
	@IsOptional()
	readonly id?: ID;

	@ApiPropertyOptional({ type: Number, description: 'Plan price' })
	@IsOptional()
	@IsNumber({}, { message: 'Price must be a valid number' })
	@Min(0, { message: 'Price cannot 	be negative' })
	@Type(() => Number)
	price?: number;

	@ApiPropertyOptional({ type: Boolean, description: 'Whether this plan is marked as popular' })
	@IsOptional()
	@IsBoolean({ message: 'isPopular must be a boolean' })
	@Transform(transformToBoolean)
	isPopular?: boolean;

	@ApiPropertyOptional({ type: Boolean, description: 'Whether this plan is recommended' })
	@IsOptional()
	@IsBoolean({ message: 'isRecommended must be a boolean' })
	@Transform(transformToBoolean)
	isRecommended?: boolean;

	@ApiPropertyOptional({ type: Number, description: 'Trial period duration in days' })
	@IsOptional()
	@IsNumber({}, { message: 'Trial days must be a number' })
	@Min(0, { message: 'Trial days cannot be negative' })
	@Type(() => Number)
	@Transform(transformToOptionalNumber)
	trialDays?: number;

	@ApiPropertyOptional({ type: Number, description: 'Setup fee for the plan' })
	@IsOptional()
	@IsNumber({}, { message: 'Setup fee must be a number' })
	@Min(0, { message: 'Setup fee cannot be negative' })
	@Type(() => Number)
	@Transform(transformToOptionalNumber)
	setupFee?: number;

	@ApiPropertyOptional({ type: Number, description: 'Discount percentage for the plan' })
	@IsOptional()
	@IsNumber({}, { message: 'Discount percentage must be a number' })
	@Min(0, { message: 'Discount percentage cannot be negative' })
	@Type(() => Number)
	@Transform(transformToOptionalNumber)
	discountPercentage?: number;

	@ApiPropertyOptional({ type: String, description: 'Plan name' })
	@IsOptional()
	@IsString({ message: 'Name must be a string' })
	@MaxLength(255, { message: 'Name cannot exceed 255 characters' })
	name?: string;

	@ApiPropertyOptional({ type: String, description: 'Plan description' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	description?: string;

	@ApiPropertyOptional({ enum: PluginSubscriptionType, description: 'Plan type' })
	@IsOptional()
	@IsEnum(PluginSubscriptionType, { message: 'Invalid plan type' })
	type?: PluginSubscriptionType;

	@ApiPropertyOptional({ enum: CurrenciesEnum, description: 'Plan currency' })
	@IsOptional()
	@IsEnum(CurrenciesEnum, { message: 'Invalid currency' })
	currency?: CurrenciesEnum;

	@ApiPropertyOptional({ enum: PluginBillingPeriod, description: 'Billing period' })
	@IsOptional()
	@IsEnum(PluginBillingPeriod, { message: 'Invalid billing period' })
	billingPeriod?: PluginBillingPeriod;

	@ApiPropertyOptional({ type: [String], description: 'Plan features' })
	@IsOptional()
	@IsArray({ message: 'Features must be an array' })
	@IsString({ each: true, message: 'Each feature must be a string' })
	features?: string[];

	@ApiPropertyOptional({ type: Object, description: 'Plan limitations' })
	@IsOptional()
	@IsObject({ message: 'Limitations must be an object' })
	limitations?: Record<string, any>;

	@ApiPropertyOptional({ type: Boolean, description: 'Is plan active' })
	@IsOptional()
	@IsBoolean({ message: 'IsActive must be a boolean' })
	@Transform(transformToBoolean)
	isActive?: boolean;

	@ApiPropertyOptional({ type: Object, description: 'Plan metadata' })
	@IsOptional()
	@IsObject({ message: 'Metadata must be an object' })
	metadata?: Record<string, any>;

	@ApiPropertyOptional({ type: Number, description: 'Sort order' })
	@IsOptional()
	@IsNumber({}, { message: 'Sort order must be a number' })
	@Type(() => Number)
	@Transform(transformToOptionalNumber)
	sortOrder?: number;
}

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
