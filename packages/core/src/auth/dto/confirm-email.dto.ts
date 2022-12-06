import { IUserEmailInput, IUserTokenInput } from '@gauzy/contracts';
import { IntersectionType } from '@nestjs/swagger';
import { UserEmailDTO, UserTokenDTO } from './../../user/dto';

/**
 * Email confirmation DTO request validation
 */
export class ConfirmEmailDTO extends IntersectionType(
    UserEmailDTO,
    UserTokenDTO,
) implements IUserEmailInput, IUserTokenInput {}