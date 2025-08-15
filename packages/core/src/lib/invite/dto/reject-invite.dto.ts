import { IUserCodeInput, IUserEmailInput, IUserTokenInput } from '@gauzy/contracts';
import { IntersectionType } from '@nestjs/swagger';
import { UserCodeDTO, UserEmailDTO, UserTokenDTO } from './../../user/dto';

/**
 * Reject invite DTO validation
 */
export class RejectInviteDTO
	extends IntersectionType(UserEmailDTO, UserCodeDTO, UserTokenDTO)
	implements IUserEmailInput, IUserCodeInput, IUserTokenInput {}
