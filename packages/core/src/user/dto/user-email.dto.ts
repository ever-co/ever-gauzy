import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { IUserEmailInput } from '@gauzy/contracts';

/**
 * User email input DTO validation
 */
export class UserEmailDTO implements IUserEmailInput {
	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsEmail()
	@Transform((params: TransformFnParams) => (params.value ? params.value.trim() : null))
	readonly email: string;
}
