import { ITenant } from './tenant.model';
import { IOrganization } from './organization.model';

// Define a type for JSON data
export type JsonData = Record<string, any> | string;

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
	archivedAt?: Date; // Date when the record was archived
}

// Common properties for entities associated with a tenant
export interface IBasePerTenantEntityModel extends IBaseEntityModel {
	tenantId?: ID; // Identifier of the associated tenant
	tenant?: ITenant; // Reference to the associated tenant
}

// Mutation input properties for entities associated with a tenant
export interface IBasePerTenantEntityMutationInput extends IBaseEntityModel {
	tenantId?: ID; // Identifier of the associated tenantCAL
	tenant?: Partial<ITenant>; // Optional fields from ITenant
}

// Common properties for entities associated with both tenant and organization
export interface IBasePerTenantAndOrganizationEntityModel extends IBasePerTenantEntityModel {
	organizationId?: ID; // Identifier of the associated organization
	organization?: IOrganization; // Reference to the associated organization
}

// Mutation input properties for entities associated with both tenant and organization
export interface IBasePerTenantAndOrganizationEntityMutationInput extends Partial<IBasePerTenantEntityMutationInput> {
	organizationId?: ID; // Identifier of the associated organization
	organization?: Partial<IOrganization>; // Allow additional fields from IOrganization
}

// Actor type defines if it's User or system performed some action
export enum ActorTypeEnum {
	System = 0, // System performed the action
	User = 1 // User performed the action
}

export enum EntityEnum {
	Candidate = 'Candidate',
	Contact = 'Contact',
	Employee = 'Employee',
	Expense = 'Expense',
	DailyPlan = 'DailyPlan',
	Invoice = 'Invoice',
	Income = 'Income',
	Organization = 'Organization',
	OrganizationContact = 'OrganizationContact',
	OrganizationDepartment = 'OrganizationDepartment',
	OrganizationDocument = 'OrganizationDocument',
	OrganizationProject = 'OrganizationProject',
	OrganizationTeam = 'OrganizationTeam',
	OrganizationProjectModule = 'OrganizationProjectModule',
	OrganizationSprint = 'OrganizationSprint',
	Task = 'Task',
	User = 'User'
}
