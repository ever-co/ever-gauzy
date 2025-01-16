import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { IEmailCheckRequest } from '@gauzy/contracts';

/**
 * DTO for checking if an email exists in the database.
 * Used in the POST method to check the existence of an email.
 */
export class CheckEmailDTO implements IEmailCheckRequest {
	/**
	 * The email address to check in the database.
	 */
	@ApiProperty({
		example: 'test@example.com',
		required: true,
		description: 'Email address to check for existence'
	})
	@IsNotEmpty()
	@IsEmail()
	email: string;
}
