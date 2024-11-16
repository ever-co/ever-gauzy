import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';

export interface IHelpCenterArticle
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description: string;
	data: string;
	index: number;
	draft: boolean;
	privacy: boolean;
	categoryId: string;
	employees?: IEmployee[];
	authors?: IHelpCenterAuthor[];
}

export interface IHelpCenterAuthor
	extends IBasePerTenantAndOrganizationEntityModel {
	articleId: string;
	article?: IHelpCenterArticle;
	employeeId: string;
	employee?: IEmployee;
	articles?: IHelpCenterArticle[];
}

export interface IHelpCenterAuthorCreate
	extends IBasePerTenantAndOrganizationEntityModel {
	articleId: string;
	employeeIds: string[];
}

export interface IHelpCenterAuthorFind
	extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
}

export interface IHelpCenterArticleUpdate extends Partial<IHelpCenterArticle> { }
