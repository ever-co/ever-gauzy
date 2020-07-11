import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from '..';

export interface IHelpCenterArticle extends IBaseEntityModel {
	name: string;
	description?: string;
	data?: string;
	index: number;
	draft: boolean;
	privacy: boolean;
	categoryId: string;
	employees?: Employee[];
	authors?: IHelpCenterAuthor[];
}

export interface IHelpCenterAuthor extends IBaseEntityModel {
	articleId: string;
	employeeId: string;
	articles?: IHelpCenterArticle[];
}
