import { IChangePasswordRequest } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsStrongPassword, MinLength } from 'class-validator';
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
	@MinLength(8, { message: 'Password should be at least 8 characters long.' })
	@IsStrongPassword(
		{
			minLength: 8,
			minLowercase: 1,
			minUppercase: 1,
			minNumbers: 1,
			minSymbols: 1
		},
		{
			message:
				'Password must contain at least 8 characters, including 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'
		}
	)
	readonly password: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty({ message: 'Confirm password should not be empty' })
	@Match(ChangePasswordRequestDTO, (it) => it.password, {
		message: 'The password and confirmation password must match.'
	})
	readonly confirmPassword: string;
}
