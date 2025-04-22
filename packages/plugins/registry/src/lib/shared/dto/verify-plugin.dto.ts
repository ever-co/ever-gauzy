import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, IsUUID } from 'class-validator';

export class VerifyPluginDTO {
	@ApiProperty({
		description: 'Unique identifier for the plugin version',
		example: '123e4567-e89b-12d3-a456-426614174000'
	})
	@IsUUID('4', { message: 'versionId must be a valid UUID v4' })
	@IsNotEmpty({ message: 'versionId is required' })
	readonly versionId: string;

	@ApiProperty({
		description: 'Digital signature for verifying the plugin',
		example: 'a1b2c3d4e5f6...'
	})
	@IsString({ message: 'signature must be a string' })
	@IsNotEmpty({ message: 'signature is required' })
	@Length(64, 512, { message: 'signature must be between 64 and 512 characters' })
	readonly signature: string;
}
