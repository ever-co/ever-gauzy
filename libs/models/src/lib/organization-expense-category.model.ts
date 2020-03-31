import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IOrganizationExpenseCategory extends IBaseEntityModel {
	name: string;
	organizationId: string;
}

export interface IOrganizationExpenseCategoryFindInput
	extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
}

export interface IOrganizationExpenseCategoryCreateInput {
	name: string;
	organizationId: string;
}

export enum OrganizationExpenseCategoryEnum {
	UPWORK = 'Upwork',
	MICROSOFT = 'Microsoft',
	BENEFIT_SYSTEMS = 'Benefit Systems',
	UDEMY = 'Udemy',
	GOOGLE = 'Google',
	CO_SHARE = 'CoShare'
}
