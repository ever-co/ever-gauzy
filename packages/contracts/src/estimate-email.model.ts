import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IEstimateEmail
	extends IBasePerTenantAndOrganizationEntityModel {
	token?: string;
	email?: string;
	expireDate?: Date;
	convertAcceptedEstimates?: boolean;
}

export interface IEstimateEmailFindInput {
	token?: string;
	email?: string;
}
