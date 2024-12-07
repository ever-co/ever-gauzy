import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ISocialAccountBase, ProviderEnum } from '@gauzy/contracts';
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

export class FindUserBySocialLoginDTO
	extends PickType(SocialLoginBodyRequestDTO, ['provider'])
	implements ISocialAccountBase
{
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly providerAccountId: string;
}
