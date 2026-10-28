import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AccountDeletionTokenDTO } from './account-deletion-token.dto';

/** Body of `POST /account-deletion/confirm`: the token, an explicit `confirm: true`, and the preview's `planHash`. */
export class ConfirmAccountDeletionDTO extends AccountDeletionTokenDTO {
	@ApiProperty({ type: () => Boolean, example: true })
	@IsBoolean()
	@Equals(true)
	readonly confirm: boolean;

	/** From the `verify` answer the user reviewed; a mismatch (what would be deleted changed) is a 409. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(128)
	readonly planHash: string;
}

/** Body of `POST /account-deletion/me`: an explicit `confirm: true` and the `GET /me` preview's `planHash`. */
export class ConfirmCurrentAccountDeletionDTO {
	@ApiProperty({ type: () => Boolean, example: true })
	@IsBoolean()
	@Equals(true)
	readonly confirm: boolean;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(128)
	readonly planHash: string;
}
