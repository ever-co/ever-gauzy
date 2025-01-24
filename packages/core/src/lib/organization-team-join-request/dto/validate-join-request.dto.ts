import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { IOrganizationTeamJoinRequestValidateInput } from '@gauzy/contracts';
import { IsString, ValidateIf } from 'class-validator';
import { ALPHA_NUMERIC_CODE_LENGTH } from '@gauzy/constants';
import { CustomLength } from '../../shared/validators';
import { UserEmailDTO } from '../../user/dto';
import { OrganizationTeamJoinRequest } from '../organization-team-join-request.entity';

/**
 * Validate team join request DTO validation
 */
export class ValidateJoinRequestDTO
	extends IntersectionType(UserEmailDTO, PickType(OrganizationTeamJoinRequest, ['organizationTeamId']))
	implements IOrganizationTeamJoinRequestValidateInput
{
	@ApiProperty({ type: () => String })
	@ValidateIf((it) => !it.token)
	@IsString()
	@CustomLength(ALPHA_NUMERIC_CODE_LENGTH)
	readonly code: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => !it.code)
	@IsString()
	readonly token: string;
}
