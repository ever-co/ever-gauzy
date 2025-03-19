import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';

export class InstallPluginDTO {
	@ApiProperty({
		description: 'Unique identifier of the plugin',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@IsUUID('4', { message: 'pluginId must be a valid UUID (version 4)' })
	@IsOptional()
	pluginId?: ID;

	@ApiProperty({
		description: 'Unique identifier of the version to install',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@IsUUID('4', { message: 'versionId must be a valid UUID (version 4)' })
	@IsNotEmpty({ message: 'versionId is required' })
	versionId: ID;
}
