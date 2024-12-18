import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IDashboard extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	description?: string;
	isDefault?: boolean;
}

export interface IDashboardCreateInput extends IDashboard {}
