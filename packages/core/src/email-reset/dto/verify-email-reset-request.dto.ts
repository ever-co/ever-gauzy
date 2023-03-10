import { IChangeEmailRequest } from '@gauzy/contracts';
import { UserCodeDTO } from '../../user/dto';

/**
 * Reset Email Request DTO validation
 */
export class VerifyEmailResetRequestDTO
	extends UserCodeDTO
	implements IChangeEmailRequest {}
