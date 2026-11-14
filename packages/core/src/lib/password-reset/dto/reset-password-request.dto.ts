import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IResetPasswordRequest } from '@gauzy/contracts';
import { UserEmailDTO } from './../../user/dto';

/**
 * Reset Password Request DTO validation
 */
export class ResetPasswordRequestDTO extends UserEmailDTO implements IResetPasswordRequest {
	/**
	 * The client app's own page for setting a new password, for the link of the email: the API adds
	 * `?token=&email=&tenantId=` to it. Used only on an origin this deployment serves; anything else
	 * gets the Gauzy app's page (see auth/email-link-origin.ts).
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(2048)
	readonly appResetPasswordUrl?: string;
}
