import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Language extends IBaseEntityModel {
	name?: string;
	description?: string;
	color?: string;
	isSelected?: boolean;
}

export interface LanguageName {
	name?: string;
}

export interface LanguageFindInput extends IBaseEntityModel {
	name?: string;
	description?: string;
	color?: string;
}
