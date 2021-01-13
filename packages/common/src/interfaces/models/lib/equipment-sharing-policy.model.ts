import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IEquipmentSharingPolicy
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	description?: string;
}
