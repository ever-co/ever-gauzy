import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * Input for creating ActivePieces integration configuration
 */
export interface IActivepiecesIntegrationConfigCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	clientId: string;
	clientSecret: string;
	callbackUrl?: string;
	postInstallUrl?: string;
	isActive?: boolean;
	description?: string;
}

/**
 * Get Activepieces integration configuration
 */
export interface ActivepiecesIntegrationConfig extends IBasePerTenantAndOrganizationEntityModel {
	clientId: string;
	clientSecret: string;
	callbackUrl: string;
	postInstallUrl: string;
	isActive: boolean;
	description: string;
}

/**
 * Input for updating ActivePieces integration configuration
 */
export interface IActivepiecesIntegrationConfigUpdateInput extends Partial<IActivepiecesIntegrationConfigCreateInput> {
	id?: ID;
}
