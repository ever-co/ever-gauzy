import { OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmptyObject, IsOptional, ValidateNested } from 'class-validator';
import { Plugin } from '../../domain/entities/plugin.entity';
import { CreatePluginSubscriptionPlanDTO } from './plugin-subscription-plan.dto';
import { PluginVersionDTO } from './plugin-version.dto';

export class CreatePluginDTO extends OmitType(Plugin, [
	'versions',
	'version',
	'source',
	'downloadCount',
	'installed',
	'lastDownloadedAt',
	'uploadedBy',
	'category',
	'subscriptionPlans'
] as const) {
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

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreatePluginSubscriptionPlanDTO)
	subscriptionPlans?: CreatePluginSubscriptionPlanDTO[];
}
