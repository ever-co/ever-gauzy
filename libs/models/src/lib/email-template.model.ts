import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface EmailTemplate extends IBaseEntityModel {
	name: string;
	mjml?: string;
	hbs: string;
	languageCode: string;
}
