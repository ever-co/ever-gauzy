import { BaseEntityModel } from './base-entity.model';

export interface OrganizationDocument extends BaseEntityModel {
	name?: string;
	organizationId?: string;
	documentUrl: string;
}
