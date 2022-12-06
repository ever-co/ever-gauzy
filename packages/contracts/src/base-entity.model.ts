import { ITenant } from './tenant.model';
import { IOrganization } from './organization.model';

export interface IBaseRelationsEntityModel {
	readonly relations?: string[];
}

export interface IBaseSoftDeleteEntityModel {
	deletedAt?: Date;
}

export interface IBaseEntityModel extends IBaseSoftDeleteEntityModel  {
	id?: string;

	readonly createdAt?: Date;
	readonly updatedAt?: Date;
}

export interface IBasePerTenantEntityModel extends IBaseEntityModel {
	tenantId?: string;
	tenant?: ITenant;
}

export interface IBasePerTenantAndOrganizationEntityModel
	extends IBasePerTenantEntityModel {
	organizationId?: string;
	organization?: IOrganization;
}
