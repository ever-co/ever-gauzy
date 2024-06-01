import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ProviderEnum } from '@gauzy/contracts';
import { IncludeTeamsDTO } from '../../../user/dto/include-teams.dto';

/**
 * Validate the social login body request
 */
export class SocialLoginBodyRequestDTO extends IncludeTeamsDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEnum(ProviderEnum, { message: 'provider `$value` must be a valid enum value' })
	readonly provider: ProviderEnum;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly token: string;
}
