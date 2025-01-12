import { HttpStatus, HttpException, Injectable } from '@nestjs/common';
import { IGenerateApiKey, IGenerateApiKeyResponse } from '@gauzy/contracts';
import { generatePassword, generateSha256Hash } from '@gauzy/utils';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { TenantApiKey } from './tenant-api-key.entity';
import { MikroOrmTenantApiKeyRepository } from './repository/mikro-orm-tenant-api-key.repository';
import { TypeOrmTenantApiKeyRepository } from './repository/type-orm-tenant-api-key.repository';

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
				apiSecret: hashedApiSecret, // Store encrypted secret
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
	 * Retrieves the `TenantApiKey` record associated with the provided API Key.
	 * Ensures that the API Key is active and not archived.
	 *
	 * @param apiKey - The API Key to look up in the database.
	 * @returns A promise resolving to the matched `TenantApiKey` object if found, or `null` if no match is found.
	 */
	async getApiKey(apiKey: string): Promise<TenantApiKey | null> {
		try {
			// Perform a database query to find an active and non-archived API key
			return await this.findOneByOptions({
				where: {
					apiKey, // Match the provided API Key
					isActive: true, // Ensure the API key is active
					isArchived: false, // Ensure the API key is not archived
				},
			});
		} catch (error) {
			// Log any errors that occur during the query
			console.error('Error fetching tenant_api_key:', error.message);
			return null;
		}
	}
}
