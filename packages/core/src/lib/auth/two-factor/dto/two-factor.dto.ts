// cspell:ignore efgh ijkl mnop
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, ITwoFactorCodeInput, ITwoFactorEnrollInput, ITwoFactorVerifyInput } from '@gauzy/contracts';

/** `POST /auth/two-factor/enroll` */
export class TwoFactorEnrollDTO implements ITwoFactorEnrollInput {
	/** The name the authenticator app shows for the account, e.g. the client app's. */
	@ApiPropertyOptional({ type: () => String, maxLength: 64, example: 'Ever Teams' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	issuer?: string;
}

/** `POST /auth/two-factor/confirm`: the first code of the app. */
export class TwoFactorConfirmDTO {
	@ApiProperty({ type: () => String, example: '123456' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(16)
	code: string;
}

/** A current code of the app, or a recovery code. */
export class TwoFactorCodeDTO implements ITwoFactorCodeInput {
	@ApiPropertyOptional({ type: () => String, example: '123456' })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	code?: string;

	@ApiPropertyOptional({ type: () => String, example: 'ABCD-EFGH-IJKL-MNOP' })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	recoveryCode?: string;
}

/** `POST /auth/two-factor/verify`: the challenge a sign-in answered, with the code that completes it. */
export class TwoFactorVerifyDTO extends TwoFactorCodeDTO implements ITwoFactorVerifyInput {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MaxLength(4096)
	challenge: string;
}

/** `GET /auth/two-factor`: the organization whose rule the status reports, when the client knows it. */
export class TwoFactorStatusQueryDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationId?: ID;
}
