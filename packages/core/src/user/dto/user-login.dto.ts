import { IntersectionType } from '@nestjs/swagger';
import { IUserEmailInput, IUserPasswordInput } from '@gauzy/contracts';
import { UserEmailDTO } from './user-email.dto';
import { UserPasswordDTO } from './user-password.dto';
import { IncludeTeamsDTO } from './include-teams.dto';

/**
 * User login DTO validation
 */
export class UserLoginDTO
	extends IntersectionType(UserEmailDTO, UserPasswordDTO)
	implements IUserEmailInput, IUserPasswordInput {}

/**
 * User SignIn Workspace DTO validation
 */
export class UserSigninWorkspaceDTO extends IntersectionType(UserLoginDTO, IncludeTeamsDTO) {}
