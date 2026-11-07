import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
	ID,
	IUserApiToken,
	IUserApiTokenCreateInput,
	IUserApiTokenExchangeInput,
	IUserApiTokenExchangeResponse,
	IUserApiTokenWithSecret,
	UserApiTokenExpiryEnum
} from '@gauzy/contracts';
import { UserApiToken } from '../user-api-token.entity';

/** `POST /api/user-api-tokens` */
export class CreateUserApiTokenDTO implements IUserApiTokenCreateInput {
	@ApiProperty({ type: () => String, maxLength: 100, description: 'What the token is for.' })
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name: string;

	@ApiProperty({ enum: UserApiTokenExpiryEnum, enumName: 'UserApiTokenExpiryEnum' })
	@IsEnum(UserApiTokenExpiryEnum)
	expiry: UserApiTokenExpiryEnum;
}

/**
 * `POST /api/auth/api-token/exchange`
 *
 * Carries no validators, and the route runs no validation pipe: a malformed token is refused with the same 401 as a
 * revoked one (see `UserApiTokenService.exchange`), where a pipe would answer it with a 400 of its own.
 */
export class ExchangeUserApiTokenDTO implements IUserApiTokenExchangeInput {
	@ApiProperty({ type: () => String, description: 'The API token.' })
	token: string;

	@ApiPropertyOptional({
		type: () => String,
		description: 'The organization to work in, for a user with several. It must be one the user is an active member of.'
	})
	organizationId?: ID;
}

/** The answer of an exchange. */
export class UserApiTokenExchangeResponseDTO implements IUserApiTokenExchangeResponse {
	@ApiProperty({ type: () => String, description: 'A short-lived access token, used like any other.' })
	token: string;
}

/**
 * An API token as every read answers it. Built field by field, so that the hash cannot reach a response whatever
 * happens to the entity.
 */
export class UserApiTokenResponseDTO implements IUserApiToken {
	@ApiProperty({ type: () => String })
	id: ID;

	@ApiProperty({ type: () => String })
	userId: ID;

	@ApiProperty({ type: () => String })
	tenantId: ID;

	@ApiProperty({ type: () => String })
	name: string;

	@ApiProperty({ type: () => String })
	prefix: string;

	@ApiProperty({ type: () => Date })
	createdAt: Date;

	@ApiPropertyOptional({ type: () => Date })
	expiresAt: Date | null;

	@ApiPropertyOptional({ type: () => Date })
	lastUsedAt: Date | null;

	@ApiPropertyOptional({ type: () => Date })
	revokedAt: Date | null;

	static fromEntity(entity: UserApiToken): UserApiTokenResponseDTO {
		const dto = new UserApiTokenResponseDTO();
		dto.id = entity.id;
		dto.userId = entity.userId;
		dto.tenantId = entity.tenantId;
		dto.name = entity.name;
		dto.prefix = entity.prefix;
		dto.createdAt = entity.createdAt;
		dto.expiresAt = entity.expiresAt ?? null;
		dto.lastUsedAt = entity.lastUsedAt ?? null;
		dto.revokedAt = entity.revokedAt ?? null;
		return dto;
	}
}

/** What creating a token answers: the plain token, this one time. */
export class UserApiTokenWithSecretResponseDTO extends UserApiTokenResponseDTO implements IUserApiTokenWithSecret {
	@ApiProperty({ type: () => String, description: 'The token. It is shown this once and cannot be read again.' })
	token: string;

	static fromCreated(entity: UserApiToken, token: string): UserApiTokenWithSecretResponseDTO {
		const dto = new UserApiTokenWithSecretResponseDTO();
		Object.assign(dto, UserApiTokenResponseDTO.fromEntity(entity));
		dto.token = token;
		return dto;
	}
}
