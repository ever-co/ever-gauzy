/**
 * `OAuthClientService` — CRUD + secret lifecycle for the multi-app OAuth
 * client registry.
 *
 * What changed from the single-app version:
 * Previously the only OAuth credentials lived in env vars and were read
 * by `SocialAuthService.getOAuthAppConfig()`. Every consumer (Activepieces)
 * shared them. This service replaces that with per-row credentials so
 * each third party (Activepieces, n8n, Make.com, …) is isolated.
 *
 * Secret handling:
 * - The plaintext `clientSecret` is generated server-side, returned to the
 *   caller exactly ONCE in the response DTO, then immediately discarded.
 * - Only the scrypt hash is persisted (`clientSecretHash` column, marked
 *   `select: false` on the entity).
 * - `validateClientSecret` is the only path that reads the hash and is
 *   used by the auth pipeline (Section 3) during the `/token` exchange.
 * - The per-client `codeSecret` is also generated server-side and kept
 *   server-side; it never leaves the row except to sign authorization
 *   codes inside `AuthService.createOAuthAppAuthorizationCode`.
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { FindManyOptions, FindOneOptions, In, IsNull } from 'typeorm';
import { hashPassword, verifyPassword } from '@gauzy/utils';
import { ID, IPagination, OAuthClientType, OAuthGrantType, RolesEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../../core/context/request-context';
import { OAuthClient } from './oauth-client.entity';
import { TypeOrmOAuthClientRepository } from './repository/type-orm-oauth-client.repository';
import { MikroOrmOAuthClientRepository } from './repository/mikro-orm-oauth-client.repository';
import { CreateOAuthClientDTO } from './dto/create-oauth-client.dto';
import { UpdateOAuthClientDTO } from './dto/update-oauth-client.dto';
import { OAuthClientResponseDTO, OAuthClientWithSecretResponseDTO } from './dto/oauth-client.response.dto';

@Injectable()
export class OAuthClientService extends TenantAwareCrudService<OAuthClient> {
	private readonly logger = new Logger(OAuthClientService.name);

	constructor(
		readonly typeOrmOAuthClientRepository: TypeOrmOAuthClientRepository,
		readonly mikroOrmOAuthClientRepository: MikroOrmOAuthClientRepository
	) {
		super(typeOrmOAuthClientRepository, mikroOrmOAuthClientRepository);
	}

	// ---------------------------------------------------------------------------
	// Identifier / secret generation
	// ---------------------------------------------------------------------------

	/**
	 * Generates a public client identifier in the form `gauzy_<base64url>`.
	 * 32 bytes of entropy → ~43 base64url characters → fits comfortably in
	 * the `varchar(64)` column with room for the prefix.
	 */
	private generateClientId(): string {
		return `gauzy_${randomBytes(32).toString('base64url')}`;
	}

	/**
	 * Generates a 48-byte high-entropy secret encoded as base64url.
	 * Used for both the plaintext `clientSecret` (which is then hashed)
	 * and the per-client `codeSecret` (which is kept as-is server-side
	 * to sign authorization codes).
	 */
	private generateSecret(): string {
		return randomBytes(48).toString('base64url');
	}

	// ---------------------------------------------------------------------------
	// Create
	// ---------------------------------------------------------------------------

	/**
	 * Register a new OAuth client. Generates `clientId`, `clientSecret`
	 * (returned plaintext exactly once), and `codeSecret` (server-side only).
	 *
	 * Whether the client is tenant-scoped or global depends on whether the
	 * caller is a SUPER_ADMIN AND explicitly omits `tenantId`. Today every
	 * authenticated request has a tenant context via JWT, so by default the
	 * row is owned by the caller's tenant. The legacy seed (Section 3) is
	 * the only path that creates a `tenantId = NULL` cross-tenant client.
	 */
	public async createClient(
		dto: CreateOAuthClientDTO,
		options?: { tenantId?: ID | null }
	): Promise<OAuthClientWithSecretResponseDTO> {
		const plaintextSecret = this.generateSecret();
		const clientSecretHash = await hashPassword(plaintextSecret);
		const codeSecret = this.generateSecret();
		const clientId = this.generateClientId();

		const tenantId =
			options?.tenantId === null
				? null
				: (options?.tenantId ?? RequestContext.currentTenantId() ?? null);

		const entity = await super.create({
			clientId,
			clientSecretHash,
			codeSecret,
			name: dto.name,
			description: dto.description ?? null,
			clientType: dto.clientType ?? OAuthClientType.CONFIDENTIAL,
			redirectUris: dto.redirectUris,
			allowedScopes: dto.allowedScopes ?? [],
			allowedGrantTypes: dto.allowedGrantTypes ?? [OAuthGrantType.AUTHORIZATION_CODE],
			pkceRequired: dto.pkceRequired ?? false,
			accessTokenTtl: dto.accessTokenTtl ?? 86400,
			refreshTokenTtl: dto.refreshTokenTtl ?? 2592000,
			tenantId: tenantId ?? undefined,
			isActive: true
		} as Partial<OAuthClient>);

		this.logger.log(
			`OAuth client created: id=${entity.id}, clientId=${clientId}, name="${dto.name}", tenantId=${tenantId ?? 'GLOBAL'}`
		);

		return OAuthClientWithSecretResponseDTO.fromEntityWithSecret(entity, plaintextSecret);
	}

	// ---------------------------------------------------------------------------
	// Read
	// ---------------------------------------------------------------------------

	/**
	 * Public lookup used by the auth pipeline during `/authorize` and
	 * `/token`. Includes both tenant-scoped clients owned by the current
	 * tenant AND global (`tenantId = NULL`) clients, and reads the
	 * `clientSecretHash` + `codeSecret` columns explicitly because they
	 * are marked `select: false` on the entity.
	 *
	 * Throws `NotFoundException` when the client doesn't exist or is
	 * inactive — the controller maps this to `400 invalid_client`.
	 */
	public async findByClientId(clientId: string): Promise<OAuthClient> {
		if (!clientId) {
			throw new BadRequestException('clientId is required');
		}

		const repo = this.typeOrmRepository;
		const client = await repo
			.createQueryBuilder('oauth_client')
			.addSelect('oauth_client.clientSecretHash')
			.addSelect('oauth_client.codeSecret')
			.where('oauth_client.clientId = :clientId', { clientId })
			.andWhere('oauth_client.isActive = :isActive', { isActive: true })
			.andWhere('oauth_client.isArchived = :isArchived', { isArchived: false })
			.getOne();

		if (!client) {
			throw new NotFoundException(`OAuth client not found or inactive: ${clientId}`);
		}

		return client;
	}

	/**
	 * Admin read — paginated list of clients visible to the caller.
	 * SUPER_ADMINs see every row in their tenant + every global row;
	 * regular ADMINs see only their tenant's rows.
	 */
	public async listForCurrentTenant(
		options?: FindManyOptions<OAuthClient>
	): Promise<IPagination<OAuthClientResponseDTO>> {
		const tenantId = RequestContext.currentTenantId();
		const isSuperAdmin = RequestContext.hasRoles([RolesEnum.SUPER_ADMIN]);

		const where: any = options?.where ?? {};
		if (isSuperAdmin) {
			// Super admins see this tenant's clients AND global rows
			where.tenantId = tenantId ? In([tenantId]) : IsNull();
		} else {
			where.tenantId = tenantId;
		}

		const [items, total] = await this.typeOrmRepository.findAndCount({
			...options,
			where
		});

		return {
			items: items.map((it) => OAuthClientResponseDTO.fromEntity(it)),
			total
		};
	}

	public async findOneSafe(id: ID): Promise<OAuthClientResponseDTO> {
		const entity = await this.findOneByIdString(id);
		if (!entity) {
			throw new NotFoundException(`OAuth client not found: ${id}`);
		}
		return OAuthClientResponseDTO.fromEntity(entity);
	}

	// ---------------------------------------------------------------------------
	// Update
	// ---------------------------------------------------------------------------

	public async updateClient(id: ID, dto: UpdateOAuthClientDTO): Promise<OAuthClientResponseDTO> {
		const existing = await this.findOneByIdString(id);
		if (!existing) {
			throw new NotFoundException(`OAuth client not found: ${id}`);
		}
		await super.update(id, dto as Partial<OAuthClient>);
		const updated = await this.findOneByIdString(id);
		return OAuthClientResponseDTO.fromEntity(updated as OAuthClient);
	}

	// ---------------------------------------------------------------------------
	// Secret rotation
	// ---------------------------------------------------------------------------

	/**
	 * Generates a fresh secret, hashes it, persists the new hash, and
	 * returns the plaintext exactly once. Useful when an operator suspects
	 * a leak — every previously issued token remains valid (different
	 * concern), but no new `/token` exchange will succeed with the old
	 * secret. Does NOT rotate `codeSecret`: any in-flight authorization
	 * code stays signed by the old per-client HMAC secret.
	 */
	public async rotateSecret(id: ID): Promise<OAuthClientWithSecretResponseDTO> {
		const existing = await this.findOneByIdString(id);
		if (!existing) {
			throw new NotFoundException(`OAuth client not found: ${id}`);
		}

		const plaintextSecret = this.generateSecret();
		const clientSecretHash = await hashPassword(plaintextSecret);

		await super.update(id, { clientSecretHash } as Partial<OAuthClient>);

		this.logger.warn(`OAuth client secret rotated: id=${id}, clientId=${existing.clientId}`);

		const refreshed = (await this.findOneByIdString(id)) as OAuthClient;
		return OAuthClientWithSecretResponseDTO.fromEntityWithSecret(refreshed, plaintextSecret);
	}

	// ---------------------------------------------------------------------------
	// Delete
	// ---------------------------------------------------------------------------

	/**
	 * Soft-delete via the inherited `softRemove` semantics. The row stays
	 * but `deletedAt` is set, so `findByClientId` (which filters on
	 * `isActive = true`) will refuse to resolve it. Equivalent in effect
	 * to revoking the third-party app.
	 */
	public async softDeleteClient(id: ID): Promise<void> {
		const existing = await this.findOneByIdString(id);
		if (!existing) {
			throw new NotFoundException(`OAuth client not found: ${id}`);
		}
		await super.update(id, { isActive: false } as Partial<OAuthClient>);
		await this.delete(id);
		this.logger.warn(`OAuth client soft-deleted: id=${id}, clientId=${existing.clientId}`);
	}

	// ---------------------------------------------------------------------------
	// Auth-pipeline helpers (consumed by Section 3 — `AuthService`)
	// ---------------------------------------------------------------------------

	/**
	 * Constant-time comparison of a presented client secret against the
	 * stored scrypt hash. Used by `AuthService.exchangeOAuthAppAuthorizationCode`
	 * during `/token` to authenticate confidential clients.
	 *
	 * Public clients (`clientType === 'public'`) have a NULL hash and are
	 * authenticated via PKCE instead — PKCE enforcement is deferred to a
	 * later phase, so for now this method returns `false` for public clients
	 * to fail safe.
	 */
	public async validateClientSecret(client: OAuthClient, plainSecret: string): Promise<boolean> {
		if (!client?.clientSecretHash || !plainSecret) {
			return false;
		}
		return verifyPassword(plainSecret, client.clientSecretHash);
	}
}
