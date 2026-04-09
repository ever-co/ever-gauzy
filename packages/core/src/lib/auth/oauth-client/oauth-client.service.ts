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
import { randomBytes } from 'node:crypto';
import { FindManyOptions, IsNull } from 'typeorm';
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
		const clientType = dto.clientType ?? OAuthClientType.CONFIDENTIAL;

		// Public clients require end-to-end PKCE support in the `/token`
		// flow, which is deferred to a later phase. Registering them now
		// would produce a row with a null `clientSecretHash` that the token
		// exchange rejects as unauthorized — i.e. an unusable client.
		// Block registration until PKCE enforcement lands.
		if (clientType !== OAuthClientType.CONFIDENTIAL) {
			throw new BadRequestException(
				'Only confidential OAuth clients can be registered at this time. Public (PKCE) client support is pending.'
			);
		}

		const plaintextSecret = this.generateSecret();
		const clientSecretHash = await hashPassword(plaintextSecret);
		const codeSecret = this.generateSecret();
		const clientId = this.generateClientId();

		const tenantId =
			options?.tenantId === null
				? null
				: (options?.tenantId ?? RequestContext.currentTenantId() ?? null);

		// For global clients (tenantId=null), we must bypass TenantAwareCrudService's automatic
		// tenant enrichment which would overwrite tenantId with the current tenant context.
		const entityData = {
			clientId,
			clientSecretHash,
			codeSecret,
			name: dto.name,
			description: dto.description ?? null,
			clientType,
			redirectUris: dto.redirectUris,
			allowedScopes: dto.allowedScopes ?? [],
			allowedGrantTypes: dto.allowedGrantTypes ?? [OAuthGrantType.AUTHORIZATION_CODE],
			pkceRequired: dto.pkceRequired ?? false,
			accessTokenTtl: dto.accessTokenTtl ?? 86400,
			refreshTokenTtl: dto.refreshTokenTtl ?? 2592000,
			// Preserve an explicit `null` so saveWithoutEnrichment persists a
			// global (cross-tenant) client; only `undefined` lets
			// TenantAwareCrudService inject the current tenant.
			tenantId: tenantId,
			isActive: true
		} as Partial<OAuthClient>;

		// Use saveWithoutEnrichment for global clients to avoid tenant enrichment
		const entity = tenantId === null
			? await this.saveWithoutEnrichment(entityData)
			: await super.create(entityData);

		this.logger.log(
			`OAuth client created: id=${entity.id}, clientId=${clientId}, name="${dto.name}", tenantId=${tenantId ?? 'GLOBAL'}, type=${clientType}`
		);

		return OAuthClientWithSecretResponseDTO.fromEntityWithSecret(entity, plaintextSecret);
	}

	// ---------------------------------------------------------------------------
	// Read
	// ---------------------------------------------------------------------------

	/**
	 * Public lookup used by the auth pipeline during `/authorize` and
	 * `/token`. Includes both tenant-scoped clients AND global (`tenantId = NULL`)
	 * clients, and reads the `clientSecretHash` + `codeSecret` columns explicitly
	 * because they are marked `select: false` on the entity.
	 *
	 * NOTE: This method intentionally has NO tenant constraint — the auth pipeline
	 * needs to resolve clients by `clientId` alone. Security is enforced via:
	 * - `isActive` / `isArchived` checks (inactive clients can't auth)
	 * - `clientSecret` validation during `/token` exchange
	 * - PKCE for public clients (when enabled)
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
			// Do not echo clientId — public OAuth flows must not distinguish invalid ids
			throw new NotFoundException('OAuth client not found or inactive');
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

		const baseWhere: any = options?.where ?? {};
		// SQL `IN (...)` does not match NULL, so to express
		// `tenantId = :tenantId OR tenantId IS NULL` we must use the
		// array-of-conditions form (TypeORM ORs them together).
		let where: any;
		if (isSuperAdmin) {
			where = tenantId
				? [
						{ ...baseWhere, tenantId },
						{ ...baseWhere, tenantId: IsNull() }
					]
				: { ...baseWhere, tenantId: IsNull() };
		} else {
			where = { ...baseWhere, tenantId };
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

	/**
	 * Lookup by primary key with the correct tenant boundary for admin
	 * mutation flows:
	 *   - Regular ADMINs: own-tenant only (delegates to `findOneByIdString`).
	 *   - SUPER_ADMINs:   own-tenant OR global (`tenantId IS NULL`).
	 *
	 * A SUPER_ADMIN of tenant A must NOT be able to reach another tenant's
	 * row by UUID, so we cannot query by `id` alone.
	 */
	private async findScopedById(id: ID): Promise<OAuthClient | null> {
		const isSuperAdmin = RequestContext.hasRoles([RolesEnum.SUPER_ADMIN]);
		if (!isSuperAdmin) {
			return this.findOneByIdString(id);
		}
		const tenantId = RequestContext.currentTenantId();
		const where: any = tenantId
			? [
					{ id, tenantId },
					{ id, tenantId: IsNull() }
				]
			: { id, tenantId: IsNull() };
		return this.typeOrmRepository.findOne({ where });
	}

	public async findOneSafe(id: ID): Promise<OAuthClientResponseDTO> {
		const entity = await this.findScopedById(id);
		if (!entity) {
			throw new NotFoundException(`OAuth client not found: ${id}`);
		}
		return OAuthClientResponseDTO.fromEntity(entity);
	}

	// ---------------------------------------------------------------------------
	// Update
	// ---------------------------------------------------------------------------

	public async updateClient(id: ID, dto: UpdateOAuthClientDTO): Promise<OAuthClientResponseDTO> {
		const existing = await this.findScopedById(id);
		if (!existing) {
			throw new NotFoundException(`OAuth client not found: ${id}`);
		}
		// Global (tenantId=null) rows cannot be updated via `super.update`
		// because the tenant-aware base service adds a `tenantId` filter;
		// fall back to a direct repository update for those.
		if (existing.tenantId === null) {
			await this.typeOrmRepository.update(id, dto as Partial<OAuthClient>);
		} else {
			await super.update(id, dto as Partial<OAuthClient>);
		}

		const updated = await this.findScopedById(id);
		return OAuthClientResponseDTO.fromEntity(updated);
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
		const existing = await this.findScopedById(id);
		if (!existing) {
			throw new NotFoundException(`OAuth client not found: ${id}`);
		}

		// Public clients intentionally have no secret — they authenticate via
		// PKCE. Rotating would overwrite their NULL hash with a real one and
		// break the public-client security model.
		if (existing.clientType !== OAuthClientType.CONFIDENTIAL) {
			throw new BadRequestException(
				'Secret rotation is only supported for confidential clients; public clients use PKCE.'
			);
		}

		const plaintextSecret = this.generateSecret();
		const clientSecretHash = await hashPassword(plaintextSecret);

		if (existing.tenantId === null) {
			await this.typeOrmRepository.update(id, { clientSecretHash } as Partial<OAuthClient>);
		} else {
			await super.update(id, { clientSecretHash } as Partial<OAuthClient>);
		}

		this.logger.warn(`OAuth client secret rotated: id=${id}, clientId=${existing.clientId}`);

		const refreshed = await this.findScopedById(id);
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
		const existing = await this.findScopedById(id);
		if (!existing) {
			throw new NotFoundException(`OAuth client not found: ${id}`);
		}
		if (existing.tenantId === null) {
			// `softRemove` applies tenant filtering; for global clients
			// (visible to SUPER_ADMINs) fall back to a direct soft-delete.
			await this.typeOrmRepository.softDelete(id);
		} else {
			await this.softRemove(id);
		}
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
	 *
	 * @param clientOrHash - Either an OAuthClient entity or just the clientSecretHash string
	 * @param plainSecret - The plaintext secret to validate
	 */
	public async validateClientSecret(
		clientOrHash: OAuthClient | string | null,
		plainSecret: string
	): Promise<boolean> {
		const clientSecretHash = typeof clientOrHash === 'string' ? clientOrHash : clientOrHash?.clientSecretHash;
		if (!clientSecretHash || !plainSecret) {
			return false;
		}
		return verifyPassword(plainSecret, clientSecretHash);
	}
}
