import { IChangePasswordRequest } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Match } from './../../shared/validators';

/**
 * Change Password Request DTO validation
 */
export class ChangePasswordRequestDTO implements IChangePasswordRequest {
	@ApiProperty({ type: () => String })
	@IsNotEmpty({ message: 'Authorization token is invalid or missing.' })
	@IsString({ message: 'Authorization token must be string.' })
	readonly token: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty({ message: 'Password should not be empty' })
	@MinLength(4, { message: 'Password should be at least 4 characters long.' })
	readonly password: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty({ message: 'Confirm password should not be empty' })
	@Match(ChangePasswordRequestDTO, (it) => it.password, {
		message: 'The password and confirmation password must match.'
	})
	readonly confirmPassword: string;
}
