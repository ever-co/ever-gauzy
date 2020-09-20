import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICountry extends IBasePerTenantAndOrganizationEntityModel {
	isoCode: string;
	country: string;
}
