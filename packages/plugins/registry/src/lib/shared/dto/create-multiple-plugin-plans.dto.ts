import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { CreatePluginSubscriptionPlanDTO } from './plugin-subscription-plan.dto';

/**
 * DTO for creating multiple plugin subscription plans at once
 */
export class CreateMultiplePluginPlansDTO {
	@ApiProperty({
		type: [CreatePluginSubscriptionPlanDTO],
		description: 'Array of plugin subscription plans to create'
	})
	@IsNotEmpty({ message: 'Plans array is required' })
	@IsArray({ message: 'Plans must be an array' })
	@ValidateNested({ each: true })
	@Type(() => CreatePluginSubscriptionPlanDTO)
	plans: CreatePluginSubscriptionPlanDTO[];
}
