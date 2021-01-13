import { ITenant } from './tenant.model';
import { IOrganization } from './organization.model';

export interface IBaseEntityModel {
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
