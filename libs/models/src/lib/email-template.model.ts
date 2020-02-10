import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface EmailTemplate extends IBaseEntityModel {
	name?: string;
	content?: string;
	languageCode?: string;
}
