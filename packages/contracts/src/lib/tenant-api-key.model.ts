import { IBasePerTenantEntityModel, IBasePerTenantEntityMutationInput } from './base-entity.model';

/**
 * Represents a tenant's API key.
 *
 * This interface defines the structure of a tenant's API key entity, including its name,
 * unique key identifier, and secret. It extends the base entity model for tenant-specific properties.
 */
export interface ITenantApiKey extends IBasePerTenantEntityModel {
	/**
	 * The name or label for the API key.
	 */
	name: string;
	/**
	 * The unique API key identifier.
	 */
	apiKey: string;
	/**
	 * The secret associated with the API key.
	 */
	apiSecret: string;
}

/**
 * Input for generating a new API key.
 *
 * This interface extends the mutation input base for tenant-specific entities
 * and includes the `name` property from `ITenantApiKey`.
 */
export interface IGenerateApiKey extends IBasePerTenantEntityMutationInput, Pick<ITenantApiKey, 'name'> {}

/**
 * Represents the response for generating a new API key.
 *
 * This interface extends `ITenantApiKey` to include the complete API key details
 * (name, key, and secret) along with any additional properties inherited from the base entity.
 */
export interface IGenerateApiKeyResponse extends ITenantApiKey {}
