import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tag } from '..';

export interface IOrganizationExpenseCategory extends IBaseEntityModel {
	name: string;
	organizationId: string;
	tags: Tag[];
}

export interface IOrganizationExpenseCategoryFindInput
	extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
}

export interface IOrganizationExpenseCategoryCreateInput {
	name: string;
	organizationId: string;
	tags: Tag[];
}

export enum OrganizationExpenseCategoryEnum {
	UPWORK = 'Upwork',
	MICROSOFT = 'Microsoft',
	BENEFIT_SYSTEMS = 'Benefit Systems',
	UDEMY = 'Udemy',
	GOOGLE = 'Google',
	CO_SHARE = 'CoShare'
}
