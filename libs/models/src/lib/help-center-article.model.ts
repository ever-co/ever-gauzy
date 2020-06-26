import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IHelpCenterArticle extends IBaseEntityModel {
	name: string;
	description?: string;
	data?: string;
	draft: string;
	categoryId: string;
}
