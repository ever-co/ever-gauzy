import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SaveOAuthSettingsDto {
	@ApiProperty({
		description: 'OAuth Client ID for ActivePieces integration',
		example: 'your-client-id'
	})
	@IsNotEmpty()
	@IsString()
	readonly client_id!: string;

	@ApiProperty({
		description: 'OAuth Client Secret for ActivePieces integration',
		example: 'your-client-secret'
	})
	@IsNotEmpty()
	@IsString()
	readonly client_secret!: string;

	@ApiProperty({
		description: 'Tenant ID',
		required: false
	})
	@IsOptional()
	@IsString()
	readonly tenantId?: string;

	@ApiProperty({
		description: 'Organization ID',
		required: false
	})
	@IsOptional()
	@IsString()
	readonly organizationId?: string;
}
