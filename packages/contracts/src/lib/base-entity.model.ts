import { ITenant } from './tenant.model';
import { IOrganization } from './organization.model';
import { IUser } from './user.model';

// Define a type for JSON data
export type JsonData = Record<string, any> | string;

/**
 * Dynamically excludes the default system-managed fields ('id', 'createdAt', 'updatedAt')
 * along with any additional keys provided.
 *
 * @template T - The original type.
 * @template K - (Optional) Additional keys to omit from T.
 */
export type OmitFields<T, K extends keyof T = never> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | K>;

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
export interface IBaseEntityModel extends IBaseEntityActionByUserModel, IBaseSoftDeleteEntityModel {
	id?: ID; // Unique identifier

	readonly createdAt?: Date; // Date when the record was created
	readonly updatedAt?: Date; // Date when the record was last updated

	isActive?: boolean; // Indicates if the record is currently active
	isArchived?: boolean; // Indicates if the record is archived
	archivedAt?: Date; // Date when the record was archived
}

export interface IBaseEntityActionByUserModel {
	createdByUser?: IUser; // User who created the record
	createdByUserId?: ID; // ID of the user who created the record

	updatedByUser?: IUser; // User who last updated the record
	updatedByUserId?: ID; // ID of the user who last updated the record

	deletedByUser?: IUser; // User who deleted the record
	deletedByUserId?: ID; // ID of the user who deleted the record
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

// Represents a base structure for generic entities, linking their unique ID with their type.
export interface IBasePerEntityType extends IBasePerTenantAndOrganizationEntityModel {
	entityId: ID; // Unique ID of the entity
	entity: BaseEntityEnum; // The type of the entity, defined in BaseEntityEnum enumeration.
}

// Actor type defines if it's User or system performed some action
export enum ActorTypeEnum {
	System = 'System', // System performed the action
	User = 'User' // User performed the action
}

// BaseEntityEnum defines the type of the entity, used in BaseEntity model
export enum BaseEntityEnum {
	Candidate = 'Candidate',
	Comment = 'Comment',
	Contact = 'Contact',
	Currency = 'Currency',
	DailyPlan = 'DailyPlan',
	Dashboard = 'Dashboard',
	DashboardWidget = 'DashboardWidget',
	Employee = 'Employee',
	Expense = 'Expense',
	Invoice = 'Invoice',
	Income = 'Income',
	Language = 'Language',
	Organization = 'Organization',
	OrganizationContact = 'OrganizationContact',
	OrganizationDepartment = 'OrganizationDepartment',
	OrganizationDocument = 'OrganizationDocument',
	OrganizationProject = 'OrganizationProject',
	OrganizationTeam = 'OrganizationTeam',
	OrganizationProjectModule = 'OrganizationProjectModule',
	OrganizationSprint = 'OrganizationSprint',
	OrganizationVendor = 'OrganizationVendor',
	ResourceLink = 'ResourceLink',
	ScreeningTask = 'ScreeningTask',
	Task = 'Task',
	TaskLinkedIssue = 'TaskLinkedIssue',
	TaskView = 'TaskView',
	User = 'User',
	Tenant = 'Tenant'
}
