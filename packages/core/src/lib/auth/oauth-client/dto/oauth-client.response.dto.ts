/**
 * Response DTOs for the OAuth client registry.
 *
 * `OAuthClientResponseDTO` — what every read endpoint returns. Strips
 *   the secret hash and the per-client `codeSecret` so they can never
 *   leak via JSON serialization, even if a future change accidentally
 *   removes the `select: false` flag from the entity.
 *
 * `OAuthClientWithSecretResponseDTO` — what `POST /oauth/clients` and
 *   `POST /oauth/clients/:id/rotate-secret` return EXACTLY ONCE. The
 *   plaintext `clientSecret` is included so the operator can copy it
 *   into the third-party app's settings; it is never persisted in
 *   plaintext and never returned by any read endpoint.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IOAuthClient, IOAuthClientWithSecret } from '@gauzy/contracts';
import { OAuthClient } from '../oauth-client.entity';

export class OAuthClientResponseDTO implements Partial<IOAuthClient> {
	id?: string;
	clientId: string;
	name: string;
	description?: string | null;
	clientType: OAuthClient['clientType'];
	redirectUris: string[];
	allowedScopes: string[];
	allowedGrantTypes: OAuthClient['allowedGrantTypes'];
	pkceRequired: boolean;
	accessTokenTtl: number;
	refreshTokenTtl: number;
	isActive?: boolean;
	tenantId?: string | null;
	createdAt?: Date;
	updatedAt?: Date;

	static fromEntity(entity: OAuthClient): OAuthClientResponseDTO {
		const dto = new OAuthClientResponseDTO();
		dto.id = entity.id;
		dto.clientId = entity.clientId;
		dto.name = entity.name;
		dto.description = entity.description ?? null;
		dto.clientType = entity.clientType;
		dto.redirectUris = entity.redirectUris;
		dto.allowedScopes = entity.allowedScopes;
		dto.allowedGrantTypes = entity.allowedGrantTypes;
		dto.pkceRequired = entity.pkceRequired;
		dto.accessTokenTtl = entity.accessTokenTtl;
		dto.refreshTokenTtl = entity.refreshTokenTtl;
		dto.isActive = entity.isActive;
		dto.tenantId = entity.tenantId ?? null;
		dto.createdAt = entity.createdAt;
		dto.updatedAt = entity.updatedAt;
		return dto;
	}
}

export class OAuthClientWithSecretResponseDTO
	extends OAuthClientResponseDTO
	implements Partial<IOAuthClientWithSecret>
{
	@ApiProperty({
		type: String,
		description:
			'Plaintext client secret. Returned exactly once on creation or rotation. Store it immediately — it cannot be retrieved again.'
	})
	clientSecret: string;

	static fromEntityWithSecret(entity: OAuthClient, plaintextSecret: string): OAuthClientWithSecretResponseDTO {
		const base = OAuthClientResponseDTO.fromEntity(entity);
		const dto = Object.assign(new OAuthClientWithSecretResponseDTO(), base);
		dto.clientSecret = plaintextSecret;
		return dto;
	}
}
