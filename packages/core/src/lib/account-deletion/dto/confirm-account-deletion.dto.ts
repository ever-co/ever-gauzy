import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean } from 'class-validator';
import { AccountDeletionTokenDTO } from './account-deletion-token.dto';

/** Body of `POST /account-deletion/confirm`: the token, and an explicit `confirm: true`. */
export class ConfirmAccountDeletionDTO extends AccountDeletionTokenDTO {
	@ApiProperty({ type: () => Boolean, example: true })
	@IsBoolean()
	@Equals(true)
	readonly confirm: boolean;
}

/** Body of `POST /account-deletion/me`: an explicit `confirm: true`. */
export class ConfirmCurrentAccountDeletionDTO {
	@ApiProperty({ type: () => Boolean, example: true })
	@IsBoolean()
	@Equals(true)
	readonly confirm: boolean;
}
