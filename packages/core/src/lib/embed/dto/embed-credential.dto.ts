import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import {
	ID,
	IEmbedCredential,
	IEmbedCredentialCreateInput,
	IEmbedCredentialWithSecret,
	IEmbedTokenExchangeInput,
	IEmbedTokenExchangeResponse
} from '@gauzy/contracts';
import { IsOrganizationBelongsToUser } from '../../shared/validators';
import { EmbedCredential } from '../embed-credential.entity';

/** `POST /api/embed-credentials` */
export class CreateEmbedCredentialDTO implements IEmbedCredentialCreateInput {
	@ApiProperty({ type: () => String, maxLength: 100, description: 'Which host uses it (shown in the list).' })
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name: string;

	/** An organization of the caller's tenant they may act in: a credential is never filed under another tenant's. */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@IsOrganizationBelongsToUser()
	organizationId: ID;
}

/**
 * `POST /api/embed/token`
 *
 * Carries no validators, and the route runs no validation pipe: a malformed credential gets the same 401 as a revoked
 * one (see `EmbedCredentialService.exchange`).
 */
export class ExchangeEmbedCredentialDTO implements IEmbedTokenExchangeInput {
	@ApiProperty({ type: () => String, description: 'The embed credential, from the host backend only.' })
	credential: string;

	@ApiPropertyOptional({ type: () => String, description: 'The member to track for, by employee id.' })
	employeeId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Or the member, by the email of their account.' })
	email?: string;
}

export class EmbedTokenExchangeResponseDTO implements IEmbedTokenExchangeResponse {
	@ApiProperty({ type: () => String, description: 'A short-lived access token limited to the timer of one member.' })
	token: string;

	@ApiProperty({ type: () => String, description: 'When it expires (ISO date).' })
	expiresAt: string;
}

/** A credential as every read answers it: built field by field, so the hash never reaches a response. */
export class EmbedCredentialResponseDTO implements IEmbedCredential {
	@ApiProperty({ type: () => String })
	id: ID;

	@ApiProperty({ type: () => String })
	name: string;

	@ApiProperty({ type: () => String })
	prefix: string;

	@ApiPropertyOptional({ type: () => String })
	organizationId?: ID;

	@ApiPropertyOptional({ type: () => String })
	createdByUserId?: ID;

	@ApiPropertyOptional({ type: () => Date })
	createdAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	lastUsedAt: Date | null;

	@ApiPropertyOptional({ type: () => Date })
	revokedAt: Date | null;

	static from(row: EmbedCredential): EmbedCredentialResponseDTO {
		const dto = new EmbedCredentialResponseDTO();
		dto.id = row.id;
		dto.name = row.name;
		dto.prefix = row.prefix;
		dto.organizationId = row.organizationId;
		dto.createdByUserId = row.createdByUserId;
		dto.createdAt = row.createdAt;
		dto.lastUsedAt = row.lastUsedAt ?? null;
		dto.revokedAt = row.revokedAt ?? null;
		return dto;
	}
}

/** The answer to a creation: the only one that holds the secret. */
export class EmbedCredentialWithSecretResponseDTO extends EmbedCredentialResponseDTO implements IEmbedCredentialWithSecret {
	@ApiProperty({ type: () => String, description: 'The secret. It is not shown again.' })
	secret: string;
}
