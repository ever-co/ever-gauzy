/**
 * DTO for `PATCH /oauth/clients/:id`.
 *
 * Mutable subset of the create DTO. `clientId`, `clientSecretHash`, and
 * `codeSecret` are intentionally NOT updatable through this endpoint —
 * the secret is rotated via the dedicated `POST /oauth/clients/:id/rotate-secret`
 * endpoint, and `clientId` / `codeSecret` are immutable for the lifetime
 * of the row (rotating them would silently break every consumer).
 */
import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { IOAuthClientUpdateInput } from '@gauzy/contracts';
import { CreateOAuthClientDTO } from './create-oauth-client.dto';

export class UpdateOAuthClientDTO
	extends PartialType(
		PickType(CreateOAuthClientDTO, [
			'name',
			'description',
			'redirectUris',
			'allowedScopes',
			'allowedGrantTypes',
			'pkceRequired',
			'accessTokenTtl',
			'refreshTokenTtl'
		] as const)
	)
	implements IOAuthClientUpdateInput
{
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}
