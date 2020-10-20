import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IJobPost extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
}
