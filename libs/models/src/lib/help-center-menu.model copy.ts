import { IHelpCenterArticle } from './help-center-article.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IHelpCenter extends IBaseEntityModel {
	name: string;
	icon: string;
	flag: string;
	privacy: string;
	language: string;
	color: string;
	description?: string;
	data?: string;
	index: number;
	children?: IHelpCenter[];
	parent?: IHelpCenter;
	article?: IHelpCenterArticle[];
}
