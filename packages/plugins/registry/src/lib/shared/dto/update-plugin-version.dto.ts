import { ID } from '@gauzy/contracts';
import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { PluginVersionDTO } from './plugin-version.dto';
import { UpdatePluginSourceDTO } from './update-plugin-source.dto';
import { IPluginVersionUpdate } from '../models/plugin-version.model';
import { IPluginSourceUpdate } from '../models/plugin-source.model';

export class UpdatePluginVersionDTO
	extends PartialType(OmitType(PluginVersionDTO, ['sources', 'pluginId', 'plugin'] as const))
	implements IPluginVersionUpdate
{
	@ApiProperty({
		description: 'Unique identifier for the plugin version',
		example: '123e4567-e89b-12d3-a456-426614174000'
	})
	@IsUUID('4', { message: 'The plugin version ID must be a valid UUID v4' })
	@IsNotEmpty({ message: 'The plugin version ID is required' })
	readonly id: ID;

	@ApiProperty({
		description: 'Updated source details for the plugin version',
		required: false,
		type: [UpdatePluginSourceDTO]
	})
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => UpdatePluginSourceDTO)
	readonly sources?: IPluginSourceUpdate[];
}
