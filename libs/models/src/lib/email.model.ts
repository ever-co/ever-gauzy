import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Email extends IBaseEntityModel {
	name?: string;
	content?: string;
	languageCode?: string;
}
