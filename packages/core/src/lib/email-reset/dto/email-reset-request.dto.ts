import { IUserEmailInput } from '@gauzy/contracts';
import { UserEmailDTO } from '../../user/dto';

/**
 * Reset email request DTO validation
 */
export class ResetEmailRequestDTO extends UserEmailDTO implements IUserEmailInput { }
