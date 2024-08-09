import { IntersectionType } from '@nestjs/swagger';
import { ILastOrganization, ILastTeam, IUserCodeInput, IUserEmailInput, IUserTokenInput } from '@gauzy/contracts';
import { UserCodeDTO, UserEmailDTO, UserLastOrganizationDTO, UserLastTeamDTO, UserTokenDTO } from '../../user/dto';
import { IncludeTeamsDTO } from '../../user/dto/include-teams.dto';

/**
 *
 */
export class WorkspaceSigninEmailVerifyDTO
	extends IntersectionType(UserEmailDTO, UserCodeDTO, IncludeTeamsDTO)
	implements IUserEmailInput, IUserCodeInput {}

/**
 *
 */
export class WorkspaceSigninDTO
	extends IntersectionType(UserEmailDTO, UserTokenDTO, UserLastTeamDTO, UserLastOrganizationDTO)
	implements IUserEmailInput, IUserTokenInput, ILastTeam, ILastOrganization {}
