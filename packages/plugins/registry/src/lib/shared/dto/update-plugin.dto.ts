import { ID, PluginStatus, PluginType } from '@gauzy/contracts';
import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { IPluginVersionUpdate } from '../models/plugin-version.model';
import { CreatePluginDTO } from './create-plugin.dto';
import { CreatePluginSubscriptionPlanDTO, UpdatePluginSubscriptionPlanDTO } from './plugin-subscription-plan.dto';
import { UpdatePluginVersionDTO } from './update-plugin-version.dto';

export class UpdatePluginDTO extends PartialType(OmitType(CreatePluginDTO, ['version', 'subscriptionPlans'] as const)) {
	@ApiProperty({
		description: 'Unique identifier for the plugin',
		example: '123e4567-e89b-12d3-a456-426614174000'
	})
	@IsUUID('4', { message: 'The plugin ID must be a valid UUID v4' })
	@IsNotEmpty({ message: 'The plugin ID is required' })
	readonly id: ID;

	@ApiProperty({ type: String, description: 'Plugin name' })
	@IsOptional()
	@IsString()
	name?: string;

	@ApiProperty({ type: String, description: 'Plugin description' })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiProperty({ enum: PluginType, description: 'Type of the plugin' })
	@IsOptional()
	@IsEnum(PluginType)
	type?: PluginType;

	@ApiProperty({ enum: PluginStatus, description: 'Status of the plugin' })
	@IsOptional()
	@IsEnum(PluginStatus)
	status?: PluginStatus;

	@ApiProperty({ type: Boolean, description: 'Plugin is active or not' })
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => {
		if (typeof value === 'boolean') return value;
		if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
		return value;
	})
	isActive?: boolean;

	@ApiProperty({ type: String, description: 'Repository URL' })
	@IsOptional()
	@IsString()
	repository?: string;

	@ApiProperty({ type: String, description: 'Author' })
	@IsOptional()
	@IsString()
	author?: string;

	@ApiProperty({ type: String, description: 'License' })
	@IsOptional()
	@IsString()
	license?: string;

	@ApiProperty({ type: String, description: 'Homepage URL' })
	@IsOptional()
	@IsString()
	homepage?: string;

	@ApiProperty({ type: Boolean, description: 'Is subscription plan enabled', default: false })
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => {
		if (value === 'true' || value === true) return true;
		if (value === 'false' || value === false) return false;
		return value;
	})
	requiresSubscription?: boolean;

	@ApiProperty({
		description: 'Updated version details for the plugin',
		required: false,
		type: UpdatePluginVersionDTO
	})
	@ValidateNested({ each: true })
	@IsOptional()
	@Type(() => UpdatePluginVersionDTO)
	readonly version?: IPluginVersionUpdate;

	@ApiProperty({
		description:
			'Subscription plans to create or update. Plans with an id will be updated, plans without an id will be created',
		required: false,
		type: [UpdatePluginSubscriptionPlanDTO]
	})
	@ValidateNested({ each: true })
	@Type(() => UpdatePluginSubscriptionPlanDTO)
	@IsOptional()
	@IsArray()
	subscriptionPlans?: Array<UpdatePluginSubscriptionPlanDTO | CreatePluginSubscriptionPlanDTO>;
}
