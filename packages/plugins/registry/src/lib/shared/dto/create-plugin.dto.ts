import { PluginStatus, PluginType } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNotEmptyObject,
	IsOptional,
	IsString,
	IsUUID,
	ValidateNested
} from 'class-validator';
import { CreatePluginSubscriptionPlanDTO } from './plugin-subscription-plan.dto';
import { PluginVersionDTO } from './plugin-version.dto';

export class CreatePluginDTO {
	@ApiProperty({ type: String, description: 'Plugin name' })
	@IsNotEmpty({ message: 'Plugin name is required' })
	@IsString({ message: 'Plugin name must be a string' })
	name: string;

	@ApiPropertyOptional({ type: String, description: 'Plugin description' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	description?: string;

	@ApiProperty({ enum: PluginType, description: 'Type of the plugin' })
	@IsEnum(PluginType, { message: 'Invalid plugin type' })
	type: PluginType;

	@ApiProperty({ enum: PluginStatus, description: 'Status of the plugin' })
	@IsEnum(PluginStatus, { message: 'Invalid plugin status' })
	status: PluginStatus;

	@ApiPropertyOptional({ type: Boolean, description: 'Plugin is active or not', default: false })
	@IsOptional()
	@IsBoolean({ message: 'isActive must be a boolean' })
	isActive?: boolean;

	@ApiPropertyOptional({ type: String, description: 'Plugin category ID' })
	@IsOptional()
	@IsUUID(4, { message: 'Category ID must be a valid UUID' })
	categoryId?: string;

	@ApiPropertyOptional({ type: String, description: 'Plugin author' })
	@IsOptional()
	@IsString({ message: 'Author must be a string' })
	author?: string;

	@ApiPropertyOptional({ type: String, description: 'Plugin license' })
	@IsOptional()
	@IsString({ message: 'License must be a string' })
	license?: string;

	@ApiPropertyOptional({ type: String, description: 'Homepage URL' })
	@IsOptional()
	@IsString({ message: 'Homepage URL must be a string' })
	homepage?: string;

	@ApiProperty({ type: String, description: 'Repository URL', required: false })
	@IsOptional()
	@IsString({ message: 'Repository URL must be a string' })
	repository?: string;

	@ValidateNested()
	@IsNotEmptyObject(
		{ nullable: true },
		{
			message: 'Version is required',
			each: true
		}
	)
	@Type(() => PluginVersionDTO)
	version: PluginVersionDTO;

	@ApiPropertyOptional({ type: [String], description: 'Plugin tags' })
	@IsOptional()
	@IsArray({ message: 'Tags must be an array' })
	@IsString({ each: true, message: 'Each tag must be a string' })
	tags?: string[];

	@ApiPropertyOptional({ type: Boolean, description: 'Whether plugin requires subscription', default: false })
	@IsOptional()
	@Transform(({ value }): boolean => Boolean(value))
	@IsBoolean({ message: 'requiresSubscription must be a boolean' })
	requiresSubscription?: boolean;

	@ApiPropertyOptional({ type: String, description: 'ID of user who uploaded the plugin' })
	@IsOptional()
	@IsUUID(4, { message: 'Uploaded by ID must be a valid UUID' })
	uploadedById?: string;

	@ApiPropertyOptional({ type: Array, description: 'Subscription plans for the plugin' })
	@IsOptional()
	@IsArray({ message: 'Subscription plans must be an array' })
	@ValidateNested({ each: true })
	@Type(() => CreatePluginSubscriptionPlanDTO)
	subscriptionPlans?: Array<CreatePluginSubscriptionPlanDTO>;
}
