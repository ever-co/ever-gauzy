import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class SaveOAuthSettingsDto {
	@ApiProperty({
		description: 'OAuth Client ID for ActivePieces integration',
		example: 'your-client-id'
	})
	@IsNotEmpty()
	@IsString()
	@Transform(({ value }) => value?.trim())
	readonly client_id!: string;

	@ApiProperty({
		description: 'OAuth Client Secret for ActivePieces integration',
		example: 'your-client-secret',
		writeOnly: true
	})
	@IsNotEmpty()
	@IsString()
	@Transform(({ value }) => value?.trim())
	readonly client_secret!: string;

	@ApiProperty({
		description: 'Tenant ID',
		required: false,
		format: 'uuid'
	})
	@IsOptional()
	@IsString()
	@IsUUID('4', { message: 'tenantId must be a valid UUID' })
	@Transform(({ value }) => value?.trim() || undefined)
	readonly tenantId?: string;

	@ApiProperty({
		description: 'Organization ID',
		required: false,
		format: 'uuid'
	})
	@IsOptional()
	@IsString()
	@IsUUID('4', { message: 'organizationId must be a valid UUID' })
	@Transform(({ value }) => value?.trim() || undefined)
	readonly organizationId?: string;
}
