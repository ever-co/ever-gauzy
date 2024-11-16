import { IHelpCenterArticle } from './help-center-article.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IHelpCenter extends IBasePerTenantAndOrganizationEntityModel {
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
	parentId?: string;
}

export interface IHelpCenterFind
	extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
}

export enum HelpCenterActionEnum {
	ADD = 'add',
	EDIT = 'edit'
}

export enum HelpCenterFlagEnum {
	BASE = 'base',
	CATEGORY = 'category'
}