import { BaseEntityModel } from './base-entity.model';

export interface OrganizationDocument extends BaseEntityModel {
	name?: string;
	organizationId?: string;
	documentUrl?: string;
}

export interface OrganizationDocumentFindInput extends BaseEntityModel {
	name?: string;
	organizationId: string;
}
