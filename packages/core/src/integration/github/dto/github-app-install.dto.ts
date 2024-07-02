import { IGithubAppInstallInput } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

/**
 *
 */
export enum GithubSetupActionEnum {
	INSTALL = 'install',
	UPDATE = 'update'
}

/**
 *
 */
export class GithubOAuthDTO extends TenantOrganizationBaseDTO implements IGithubAppInstallInput {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly code: string;
}

/**
 *
 */
export class GithubAppInstallDTO implements IGithubAppInstallInput {
	@ApiPropertyOptional({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly installation_id: string;

	@ApiPropertyOptional({ type: () => String })
	@IsNotEmpty()
	@IsEnum(GithubSetupActionEnum)
	readonly setup_action: GithubSetupActionEnum;
}
