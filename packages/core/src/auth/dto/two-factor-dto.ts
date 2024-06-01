import { IntersectionType } from '@nestjs/swagger';
import { IUserCodeInput, IUserEmailInput, IUserTokenInput } from '@gauzy/contracts';
import { UserCodeDTO, UserEmailDTO, UserTokenDTO } from '../../user/dto';
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
	extends IntersectionType(UserEmailDTO, UserTokenDTO)
	implements IUserEmailInput, IUserTokenInput {}
