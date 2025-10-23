import { IBasePerTenantAndOrganizationEntityModel, ID, IUser } from '@gauzy/contracts';
import { IPluginInstallation } from './plugin-installation.model';

/**
 * Interface for plugin user assignments
 */
export interface IPluginUserAssignment extends IBasePerTenantAndOrganizationEntityModel {
	// Plugin installation this assignment is for
	pluginInstallation: IPluginInstallation;
	pluginInstallationId: ID;

	// User assigned to the plugin installation
	user: IUser;
	userId: ID;

	// User who assigned this access
	assignedBy?: IUser;
	assignedById?: ID;

	// Date when the user was assigned to the plugin
	assignedAt?: Date;

	// Date when the user assignment was revoked
	revokedAt?: Date;

	// User who revoked this access
	revokedBy?: IUser;
	revokedById?: ID;

	// Reason for the assignment
	reason?: string;

	// Reason for revoking the assignment
	revocationReason?: string;

	// Whether this assignment is currently active
	isActive: boolean;
}

/**
 * Interface for creating plugin user assignments
 */
export interface IPluginUserAssignmentCreateInput
	extends Omit<
		IPluginUserAssignment,
		'id' | 'createdAt' | 'updatedAt' | 'pluginInstallation' | 'user' | 'assignedBy' | 'revokedBy'
	> {
	pluginInstallationId: ID;
	userId: ID;
	assignedById?: ID;
}

/**
 * Interface for updating plugin user assignments
 */
export interface IPluginUserAssignmentUpdateInput
	extends Partial<Omit<IPluginUserAssignmentCreateInput, 'pluginInstallationId' | 'userId'>> {}

/**
 * Interface for finding plugin user assignments
 */
export interface IPluginUserAssignmentFindInput
	extends Partial<Pick<IPluginUserAssignment, 'pluginInstallationId' | 'userId' | 'assignedById' | 'isActive'>> {}

/**
 * Interface for bulk assignment operations
 */
export interface IPluginUserBulkAssignmentInput {
	pluginInstallationIds: ID[];
	userIds: ID[];
	assignedById?: ID;
	reason?: string;
}