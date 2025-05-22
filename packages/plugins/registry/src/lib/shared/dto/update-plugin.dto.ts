import { ID } from '@gauzy/contracts';
import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { CreatePluginDTO } from './create-plugin.dto';
import { UpdatePluginVersionDTO } from './update-plugin-version.dto';
import { IPluginUpdate } from '../models/plugin.model';
import { IPluginVersionUpdate } from '../models/plugin-version.model';

export class UpdatePluginDTO
	extends PartialType(OmitType(CreatePluginDTO, ['version'] as const))
	implements IPluginUpdate
{
	@ApiProperty({
		description: 'Unique identifier for the plugin',
		example: '123e4567-e89b-12d3-a456-426614174000'
	})
	@IsUUID('4', { message: 'The plugin ID must be a valid UUID v4' })
	@IsNotEmpty({ message: 'The plugin ID is required' })
	readonly id: ID;

	@ApiProperty({
		description: 'Updated version details for the plugin',
		required: false,
		type: UpdatePluginVersionDTO
	})
	@ValidateNested({ each: true })
	@IsOptional()
	@Type(() => UpdatePluginVersionDTO)
	readonly version?: IPluginVersionUpdate;
}
