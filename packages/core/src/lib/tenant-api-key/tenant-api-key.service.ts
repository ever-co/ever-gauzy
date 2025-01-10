import { HttpStatus, HttpException, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { IGenerateApiKey, IGenerateApiKeyResponse } from '@gauzy/contracts';
import { generatePassword, generateUuidWithoutDashes } from '@gauzy/utils';
import { EncryptionService } from '../common/encryption/encryption.service';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { TenantApiKey } from './tenant-api-key.entity';
import { MikroOrmTenantApiKeyRepository } from './repository/mikro-orm-tenant-api-key.repository';
import { TypeOrmTenantApiKeyRepository } from './repository/type-orm-tenant-api-key.repository';

@Injectable()
export class TenantApiKeyService extends TenantAwareCrudService<TenantApiKey> {
	constructor(
		readonly typeOrmTenantApiKeyRepository: TypeOrmTenantApiKeyRepository,
		readonly mikroOrmTenantApiKeyRepository: MikroOrmTenantApiKeyRepository,
		private readonly _encryptionService: EncryptionService
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
			const apiKey = generateUuidWithoutDashes(); // Generate UUID without dashes
			const apiSecret = generatePassword(64); // Generate a random password

			// Encrypt the API secret
			const encryptedSecret = this.encryptSecret(apiSecret);

			// Save the API key and encrypted secret to the database
			const tenantApiKey = await this.create({
				name: input.name,
				apiKey,
				apiSecret: encryptedSecret, // Store encrypted secret
			});

			// Return the generated API key object
			return {
				tenantId: tenantApiKey.tenantId,
				name: tenantApiKey.name,
				apiKey: tenantApiKey.apiKey,
				apiSecret, // Return plain text secret for immediate use
			};
		} catch (error) {
			throw new HttpException(`Failed to generate API key. Please try again: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Checks if an API key exists for a tenant by tenant ID.
	 *
	 * @param {string} tenantId - The ID of the tenant.
	 * @returns {Promise<boolean>} Returns true if an API key exists, false otherwise.
	 */
	private async findByTenantId(tenantId: string): Promise<boolean> {
		try {
			const count = await this.countBy({ tenantId });
			return count > 0; // Return true if count is greater than 0
		} catch (error) {
			console.log(`Error checking API key existence: ${error.message}`);
			return false; // Return false in case of an error
		}
	}

	/**
	 * Encrypts the API secret using the encryption service.
	 *
	 * @param {string} apiSecret - The plain text API secret to encrypt.
	 * @returns {string} The encrypted API secret.
	 */
	private encryptSecret(apiSecret: string): string {
		return this._encryptionService.encrypt(apiSecret);
	}

	/**
	 * Find a TenantApiKey based on the provided API key.
	 * @param options The FindOptionsWhere object specifying the search criteria.
	 * @returns A Promise that resolves to a TenantApiKey or null if not found.
	 */
	async findApiKeyByOptions(options: FindOptionsWhere<TenantApiKey>): Promise<TenantApiKey | null> {
		try {
			const tenantApiKey = await this.findOneByOptions({
				where: {
					...options,
					isActive: true,
					isArchived: false,
					// Also Filter by Tenant's isActive & isArchived flag
					tenant: {
						isActive: true, // Filter by related Tenant's isActive being true
						isArchived: false // Filter by related Tenant's isArchived being false
					}
				},
				relations: {
					tenant: true // Include the related Tenant entity in the result
				}
			});
			return tenantApiKey || null;
		} catch (error) {
			// Handle any errors that may occur during the database query
			console.error('Error fetching tenant_api_key: %s', error.message);
			return null;
		}
	}
}
