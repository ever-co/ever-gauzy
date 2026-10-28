import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body of `POST /account-deletion/verify`: the token from the emailed link. */
export class AccountDeletionTokenDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(128)
	readonly token: string;
}
