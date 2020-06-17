import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IHelpCenterArticle extends IBaseEntityModel {
	name: string;
	privacy: string;
	description?: string;
	data?: string;
	categoryId: string;
}
