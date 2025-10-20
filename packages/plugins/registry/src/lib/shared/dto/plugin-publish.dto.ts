import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PluginPricingType, PluginBillingPeriod } from '../models/plugin.model';

export class PluginPricingDTO {
	@ApiProperty({ description: 'Pricing type' })
	@IsEnum(PluginPricingType)
	type: PluginPricingType;

	@ApiPropertyOptional({ description: 'Plugin price' })
	@IsOptional()
	@IsNumber()
	price?: number;

	@ApiPropertyOptional({ description: 'Currency code' })
	@IsOptional()
	@IsString()
	currency?: string;

	@ApiPropertyOptional({ description: 'Billing period for subscription' })
	@IsOptional()
	@IsEnum(PluginBillingPeriod)
	billingPeriod?: PluginBillingPeriod;

	@ApiPropertyOptional({ description: 'Trial period in days' })
	@IsOptional()
	@IsNumber()
	trialPeriodDays?: number;
}

export class PublishPluginDTO {
	@ApiProperty({ description: 'Plugin name' })
	@IsString()
	name: string;

	@ApiProperty({ description: 'Plugin description' })
	@IsString()
	description: string;

	@ApiProperty({ description: 'Plugin version' })
	@IsString()
	version: string;

	@ApiPropertyOptional({ description: 'Plugin category ID' })
	@IsOptional()
	@IsString()
	categoryId?: string;

	@ApiPropertyOptional({ description: 'Plugin tags' })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	tags?: string[];

	@ApiProperty({ description: 'Plugin pricing information' })
	@ValidateNested()
	@Type(() => PluginPricingDTO)
	pricing: PluginPricingDTO;

	@ApiPropertyOptional({ description: 'Plugin icon URL' })
	@IsOptional()
	@IsString()
	iconUrl?: string;

	@ApiPropertyOptional({ description: 'Plugin screenshot URLs' })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	screenshots?: string[];

	@ApiPropertyOptional({ description: 'Plugin documentation URL' })
	@IsOptional()
	@IsString()
	documentationUrl?: string;

	@ApiPropertyOptional({ description: 'Plugin support URL' })
	@IsOptional()
	@IsString()
	supportUrl?: string;

	@ApiPropertyOptional({ description: 'Plugin website URL' })
	@IsOptional()
	@IsString()
	websiteUrl?: string;

	@ApiPropertyOptional({ description: 'Plugin license' })
	@IsOptional()
	@IsString()
	license?: string;

	@ApiPropertyOptional({ description: 'Auto-publish after approval' })
	@IsOptional()
	@IsBoolean()
	autoPublish?: boolean;

	@ApiPropertyOptional({ description: 'Release notes' })
	@IsOptional()
	@IsString()
	releaseNotes?: string;
}
