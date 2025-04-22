import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { ICreateZapierIntegrationInput, ZapierGrantType } from '../zapier.types';

export class CreateZapierIntegrationDto extends TenantOrganizationBaseDTO implements ICreateZapierIntegrationInput {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	client_id!: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	code!: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsIn(['authorization_code', 'refresh_token'])
	grant_type!: ZapierGrantType;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	redirect_uri!: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	client_secret!: string;
}
