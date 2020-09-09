import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface OrganizationAwards extends IBaseEntityModel {
	name: string;
	year: string;
  organization?: Organization;
  organizationId?: string;
	tenant: ITenant;
	tenantId?: string;
}

export interface OrganizationAwardsFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	year?: string;
}

export interface OrganizationAwardsCreateInput {
	name: string;
	organizationId: string;
	year: string;
}
