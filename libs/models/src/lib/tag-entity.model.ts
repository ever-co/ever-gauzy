import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface Tag extends IBaseEntityModel {
	name?: string;
	description?: string;
	color?: string;
	isSelected?: boolean;
	organization?: Organization;
	organizationId?: string;
	tenant?: ITenant;
	tenantId?: string;
}

export interface TagName {
	name?: string;
}
