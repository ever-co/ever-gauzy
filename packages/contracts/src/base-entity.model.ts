import { ITenant } from './tenant.model';
import { IOrganization } from './organization.model';

/**
 * @description
 * An entity ID. Represents a unique identifier as a string.
 *
 * @docsCategory Type Definitions
 * @docsSubcategory Identifiers
 */
export type ID = string;

// Common properties for entities with relations
export interface IBaseRelationsEntityModel {
	relations?: string[]; // List of related entities
}

// Common properties for soft delete entities
export interface IBaseSoftDeleteEntityModel {
	deletedAt?: Date; // Indicates if the record is soft deleted
}

// Common properties for entities
export interface IBaseEntityModel extends IBaseSoftDeleteEntityModel {
	id?: ID; // Unique identifier

	readonly createdAt?: Date; // Date when the record was created
	readonly updatedAt?: Date; // Date when the record was last updated

	isActive?: boolean; // Indicates if the record is currently active
	isArchived?: boolean; // Indicates if the record is archived
}

// Common properties for entities associated with a tenant
export interface IBasePerTenantEntityModel extends IBaseEntityModel {
	tenantId?: ID; // Identifier of the associated tenant
	tenant?: ITenant; // Reference to the associated tenant
}

// Mutation input properties for entities associated with a tenant
export interface IBasePerTenantEntityMutationInput
	extends Pick<IBasePerTenantEntityModel, 'tenantId'>,
		IBaseEntityModel {
	tenant?: Pick<ITenant, 'id'> & Partial<ITenant>; // Optional fields from ITenant
}

// Common properties for entities associated with both tenant and organization
export interface IBasePerTenantAndOrganizationEntityModel extends IBasePerTenantEntityModel {
	organizationId?: ID; // Identifier of the associated organization
	organization?: IOrganization; // Reference to the associated organization
}

// Mutation input properties for entities associated with both tenant and organization
export interface IBasePerTenantAndOrganizationEntityMutationInput
	extends Pick<IBasePerTenantAndOrganizationEntityModel, 'organizationId'>,
		Partial<IBasePerTenantEntityMutationInput> {
	organization?: Pick<IOrganization, 'id'> & Partial<IOrganization>; // Allow additional fields from IOrganization
}
