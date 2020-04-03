import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Tag extends IBaseEntityModel {
	name?: string;
	description?: string;
	color?: string;
	isSelected?: boolean;
}

export interface TagName {
	name?: string;
}
