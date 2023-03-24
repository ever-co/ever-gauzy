import { IUserCodeInput } from '@gauzy/contracts';
import { UserCodeDTO } from '../../user/dto';

/**
 * Verify reset email request DTO validation
 */
export class VerifyEmailResetRequestDTO extends UserCodeDTO implements IUserCodeInput { }
