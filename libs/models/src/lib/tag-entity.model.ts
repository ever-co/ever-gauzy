import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';

export interface Tag extends IBaseEntityModel {
	name?: string;
	description?: string;
	color?: string;
	isSelected?: boolean;
	organization?: Organization;
}

export interface TagName {
	name?: string;
}
