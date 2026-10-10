import { BadRequestException, ForbiddenException, HttpStatus, HttpException, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { ID, IGenerateApiKey, IGenerateApiKeyResponse } from '@gauzy/contracts';
import { generatePassword, generateSha256Hash } from '@gauzy/utils';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { TenantApiKey } from './tenant-api-key.entity';
import { MikroOrmTenantApiKeyRepository } from './repository/mikro-orm-tenant-api-key.repository';
import { TypeOrmTenantApiKeyRepository } from './repository/type-orm-tenant-api-key.repository';

/**
 * A tenant's API key as an administrator may read it back: which pair it is and what it is called — never
 * the key or the secret. The secret is shown once, at issuance, and stored only as a digest.
 */
export interface ITenantApiKeyView {
	id: ID;
	tenantId: ID;
	name?: string;
	isActive?: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

@Injectable()
export class TenantApiKeyService extends TenantAwareCrudService<TenantApiKey> {
	constructor(
		readonly typeOrmTenantApiKeyRepository: TypeOrmTenantApiKeyRepository,
		readonly mikroOrmTenantApiKeyRepository: MikroOrmTenantApiKeyRepository
	) {
		super(typeOrmTenantApiKeyRepository, mikroOrmTenantApiKeyRepository);
	}

	/**
	 * Generates a new API key and secret for a tenant.
	 *
	 * This function creates a unique API key (UUID without dashes) and a secure secret key.
	 * These keys are used for tenant authentication and identification.
	 *
	 * @param {IGenerateApiKey} input - Data required to generate the API key, including a name or label for the key.
	 * @returns {Promise<IGenerateApiKeyResponse>} A promise that resolves to the generated API key object.
	 *
	 * @example
	 * const apiKey = await tenantApiKeyService.generateApiKey({ name: 'Main API Key' });
	 * console.log(apiKey);
	 * {
	 *   tenantId: '12345',
	 *   name: 'Main API Key',
	 *   apiKey: 'e48bfc3c1e724e7a931f501bc0036b45',
	 *   apiSecret: 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6'
	 * }
	 */
	async generateApiKey(input: IGenerateApiKey): Promise<IGenerateApiKeyResponse> {
		try {
			// Get the tenant ID
			const tenantId = input.tenantId ?? RequestContext.currentTenantId();

			// Check if an API key already exists for the tenant
			const existingKey = await this.findByTenantId(tenantId);

			if (existingKey) {
				throw new HttpException(`API key already exists for tenant.`, HttpStatus.CONFLICT);
			}

			// Generate API key and secret
			const apiKey = generatePassword(32); // Generate a random password
			const apiSecret = generatePassword(64); // Generate a random password
			const hashedApiSecret = generateSha256Hash(apiSecret); // Encrypt the API secret

			// Save the API key and encrypted secret to the database
			const tenantApiKey = await this.create({
				name: input.name,
				apiKey,
				apiSecret: hashedApiSecret // Store encrypted secret
			});

			// Return the generated API key object
			return {
				tenantId: tenantApiKey.tenantId,
				name: tenantApiKey.name,
				apiKey: tenantApiKey.apiKey,
				apiSecret // Return plain text secret for immediate use
			};
		} catch (error) {
			throw new HttpException(
				`Failed to generate API key. Please try again: ${error.message}`,
				HttpStatus.BAD_REQUEST
			);
		}
	}

	/**
	 * Renames the caller's tenant's API key. The name is the only member that may change: the key and the
	 * secret are a pair issued together, and a new pair is had by revoking this one and generating again.
	 *
	 * @param name The new label, 1 to 255 characters.
	 * @returns The key as an administrator may read it back — without the key or the secret.
	 * @throws ForbiddenException when the request carries no tenant.
	 * @throws NotFoundException when the tenant holds no live key.
	 */
	async renameApiKey(name: string): Promise<ITenantApiKeyView> {
		const tenantId = this.tenantOfCaller();
		const label = typeof name === 'string' ? name.trim() : '';

		if (!label || label.length > 255) {
			throw new BadRequestException('A key name must be 1 to 255 characters.');
		}

		// The tenant-scoped read: a revoked (soft-deleted) key is not found, so it cannot be renamed back.
		const key = await this.findOneByOptions({ where: { tenantId }, order: { createdAt: 'DESC' } } as never);

		await this.update(key.id, { name: label });

		return this.view({ ...key, name: label });
	}

	/**
	 * Revokes the caller's tenant's API key, so that a leaked pair stops authenticating and a new pair can
	 * be generated.
	 *
	 * The row is marked inactive — the check every authenticating read makes — and then withdrawn by soft
	 * delete, so it no longer counts as the tenant's key (`findByTenantId`, which refuses a second key,
	 * reads live rows only) while the record of it is kept. Every live key of the tenant is revoked: there
	 * should be one, and a second one left by an old race must not survive a revocation either.
	 *
	 * @returns `true` when a key was revoked, `false` when the tenant held none.
	 * @throws ForbiddenException when the request carries no tenant.
	 */
	async revokeApiKey(): Promise<boolean> {
		const tenantId = this.tenantOfCaller();
		const keys = await this.find({ where: { tenantId } } as never);

		if (!keys?.length) {
			return false;
		}

		for (const key of keys) {
			await this.update(key.id, { isActive: false });
			await this.softRemove(key.id);
		}

		return true;
	}

	/** The credential's tenant, or a refusal: a key is always the caller's own tenant's. */
	private tenantOfCaller(): ID {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId) {
			throw new ForbiddenException();
		}

		return tenantId;
	}

	/** The members an administrator may read back; built member by member so no secret can ride along. */
	private view(key: TenantApiKey): ITenantApiKeyView {
		return {
			id: key.id,
			tenantId: key.tenantId,
			name: key.name,
			isActive: key.isActive,
			createdAt: key.createdAt,
			updatedAt: key.updatedAt
		};
	}

	/**
	 * Checks whether an API key exists for the given tenant ID.
	 *
	 * Live keys only: a revoked key is soft-deleted, and the CRUD count reads live rows only, so a revoked
	 * key never blocks generating a new pair.
	 *
	 * @param tenantId - The unique identifier of the tenant.
	 * @returns A promise resolving to `true` if an API key exists for the tenant, otherwise `false`.
	 */
	private async findByTenantId(tenantId: ID): Promise<boolean> {
		try {
			const count = await this.countBy({ tenantId });
			return count > 0; // Return true if there are matching API keys
		} catch (error) {
			console.error(`Database Error: Failed to check API key existence. Reason: ${error.message}`);
			return false; // Return false if an error occurs
		}
	}

	/**
	 * Retrieves the `TenantApiKey` record associated with the provided API Key.
	 * Ensures that the API Key is active and not archived.
	 *
	 * @param apiKey - The API Key to look up in the database.
	 * @returns A promise resolving to the matched `TenantApiKey` object if found, or `null` if no match is found.
	 */
	private async getApiKey(apiKey: string): Promise<TenantApiKey | null> {
		try {
			// Perform a database query to find an active and non-archived API key
			return await this.findOneByOptions({
				where: {
					apiKey, // Match the provided API Key
					isActive: true, // Ensure the API key is active
					isArchived: false // Ensure the API key is not archived
				}
			});
		} catch (error) {
			// Log any errors that occur during the query
			console.error('Error fetching tenant_api_key:', error.message);
			return null;
		}
	}

	/**
	 * Validates the provided API Key and Secret by querying the database.
	 *
	 * @param apiKey - The API Key to validate.
	 * @param apiSecret - The API Secret to validate.
	 * @returns A promise resolving to the `TenantApiKey` entity if valid, otherwise `null`.
	 */
	async validateApiKeyAndSecret(apiKey: string, apiSecret: string): Promise<TenantApiKey | null> {
		try {
			// Retrieve the corresponding tenant_api_key record based on the apiKey
			const tenantApiKey = await this.getApiKey(apiKey);

			// If the API Key is not found or validation fails, return null
			if (!tenantApiKey || !this.validateApiKey(apiSecret, tenantApiKey.apiSecret)) {
				console.warn(`Unauthorized: Invalid API Key (X-APP-ID) or Secret (X-API-KEY) for API Key`);
				return null;
			}

			return tenantApiKey; // Return the tenant API key entity if valid
		} catch (error) {
			console.error(`Database Error: Failed to retrieve tenant API key. Reason: ${error.message}`);
			return null;
		}
	}

	/**
	 * Validates the API Secret by hashing the provided secret key and comparing it with the stored hash.
	 *
	 * @param secretKey - The raw API secret provided in the request.
	 * @param apiSecret - The hashed API secret stored in the database.
	 * @returns `true` if the secrets match, otherwise `false`.
	 */
	private validateApiKey(secretKey: string, apiSecret: string): boolean {
		// Hash the provided secret key
		const hashedApiSecret = this.hashApiSecret(secretKey);
		// Compare the hashed secret with the stored hash
		return timingSafeEqual(Buffer.from(hashedApiSecret), Buffer.from(apiSecret));
	}

	/**
	 * Hashes the provided secret key using SHA-256.
	 *
	 * @param secretKey - The raw API secret key.
	 * @returns The SHA-256 hashed hexadecimal representation of the secret key.
	 */
	private hashApiSecret(secretKey: string): string {
		// Hash the secret using SHA-256
		return createHash('sha256').update(secretKey).digest('hex');
	}
}
