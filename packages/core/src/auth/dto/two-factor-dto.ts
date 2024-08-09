import { IntersectionType } from '@nestjs/swagger';
import { IDefaultTeam, IUserCodeInput, IUserEmailInput, IUserTokenInput } from '@gauzy/contracts';
import { UserCodeDTO, UserEmailDTO, UserTokenDTO, UserDefaultTeamDTO } from '../../user/dto';
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
	extends IntersectionType(UserEmailDTO, UserTokenDTO, UserDefaultTeamDTO)
	implements IUserEmailInput, IUserTokenInput, IDefaultTeam {}
