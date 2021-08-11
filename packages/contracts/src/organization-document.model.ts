import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IOrganizationDocument
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	documentUrl: string;
}

export interface IOrganizationDocumentFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
}
