/**
 * `OAuthClient` — registry row for the multi-app OAuth Authorization Server.
 *
 * What changed from the single-app version:
 *
 * Previously, there was no entity at all. The single OAuth client was
 * hardcoded via `GAUZY_OAUTH_APP_*` env vars in `packages/config` and
 * read by `SocialAuthService.getOAuthAppConfig()`. Every third party
 * (only Activepieces existed) shared the same `client_id`/`client_secret`.
 *
 * This entity persists one row per registered third party (Activepieces,
 * n8n, Make.com, future apps) so each gets isolated credentials, redirect
 * URIs, and scopes. The row is owned by a tenant via the inherited
 * nullable `tenantId` from `TenantBaseEntity` — null means a global,
 * cross-tenant client (matches the previous single-app behavior used by
 * the legacy seed).
 *
 * NOTE: `accessTokenTtl` and `refreshTokenTtl` are stored on the row so
 * the registry shape is final, but per-client TTL enforcement is deferred
 * to a follow-up PR — token issuance still uses the global
 * `JWT_TOKEN_EXPIRATION_TIME` for now.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { IOAuthClient, OAuthClientType, OAuthGrantType } from '@gauzy/contracts';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../../core/decorators/entity';
import { TenantBaseEntity } from '../../core/entities/internal';

@MultiORMEntity('oauth_clients')
export class OAuthClient extends TenantBaseEntity implements IOAuthClient {
	/**
	 * Public client identifier exposed to third parties.
	 * Generated as `gauzy_<base64url>` by `OAuthClientService.create`.
	 */
	@ApiProperty({ type: String, maxLength: 64 })
	@IsString()
	@MaxLength(64)
	@ColumnIndex({ unique: true })
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: false })
	clientId: string;

	/**
	 * bcrypt-hashed client secret. Null only for `public` clients.
	 * The plaintext is returned EXACTLY ONCE on creation / rotation
	 * and is never persisted in plaintext or returned by any read endpoint.
	 */
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true, select: false })
	clientSecretHash: string | null;

	/**
	 * Per-client HMAC secret used to sign authorization codes
	 * (`v1.<payload>.<sig>` format). Stored per-client so revoking one
	 * third party cannot forge codes for another. Never returned by the API.
	 */
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: false, select: false })
	codeSecret: string;

	@ApiProperty({ type: String, maxLength: 100 })
	@IsString()
	@MaxLength(100)
	@MultiORMColumn({ type: 'varchar', length: 100, nullable: false })
	name: string;

	@ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@MultiORMColumn({ type: 'varchar', length: 500, nullable: true })
	description?: string | null;

	@ApiProperty({ enum: OAuthClientType, enumName: 'OAuthClientType' })
	@IsEnum(OAuthClientType)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: OAuthClientType,
		default: OAuthClientType.CONFIDENTIAL
	})
	clientType: OAuthClientType;

	@ApiProperty({ type: [String] })
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	@JsonColumn({ nullable: false })
	redirectUris: string[];

	@ApiProperty({ type: [String] })
	@IsArray()
	@IsString({ each: true })
	@JsonColumn({ nullable: false })
	allowedScopes: string[];

	@ApiProperty({ enum: OAuthGrantType, enumName: 'OAuthGrantType', isArray: true })
	@IsArray()
	@IsEnum(OAuthGrantType, { each: true })
	@JsonColumn({ nullable: false })
	allowedGrantTypes: OAuthGrantType[];

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	pkceRequired: boolean;

	@ApiProperty({ type: Number, description: 'Access token TTL in seconds (deferred enforcement)' })
	@IsInt()
	@Min(60)
	@MultiORMColumn({ type: 'int', default: 86400 })
	accessTokenTtl: number;

	@ApiProperty({ type: Number, description: 'Refresh token TTL in seconds (deferred enforcement)' })
	@IsInt()
	@Min(60)
	@MultiORMColumn({ type: 'int', default: 2592000 })
	refreshTokenTtl: number;

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	/**
	 * Whether the supplied redirect URI is in this client's allowlist.
	 * Exact-match comparison (no wildcard, no path-prefix), matching the
	 * behavior of the previous single-app `isOAuthAppRedirectUriAllowed`.
	 */
	public isRedirectUriAllowed(redirectUri: string): boolean {
		return Array.isArray(this.redirectUris) && this.redirectUris.includes(redirectUri);
	}

	/**
	 * Whether every requested scope is contained in `allowedScopes`.
	 * Empty / undefined input is treated as "no scopes requested" → allowed.
	 */
	public areScopesAllowed(requestedScope?: string): boolean {
		if (!requestedScope) return true;
		const requested = requestedScope.split(/\s+/).filter(Boolean);
		return requested.every((s) => this.allowedScopes.includes(s));
	}

	/**
	 * Whether this client is allowed to use the given grant type.
	 */
	public isGrantTypeAllowed(grantType: OAuthGrantType): boolean {
		return this.allowedGrantTypes.includes(grantType);
	}
}
