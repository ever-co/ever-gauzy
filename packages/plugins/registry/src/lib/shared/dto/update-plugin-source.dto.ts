import { ID } from '@gauzy/contracts';
import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { PluginSourceDTO } from './plugin-source.dto';
import { IPluginSourceUpdate } from '../models/plugin-source.model';

export class UpdatePluginSourceDTO
	extends PartialType(OmitType(PluginSourceDTO, ['version'] as const))
	implements IPluginSourceUpdate
{
	@ApiProperty({
		description: 'Unique identifier for the plugin source',
		example: '123e4567-e89b-12d3-a456-426614174000'
	})
	@IsUUID('4', { message: 'The plugin source ID must be a valid UUID v4' })
	@IsNotEmpty({ message: 'The plugin source ID is required' })
	readonly id: ID;
}
