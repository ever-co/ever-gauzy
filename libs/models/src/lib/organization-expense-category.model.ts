import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tag } from '..';

export interface IOrganizationExpenseCategory extends IBaseEntityModel {
	name: string;
	organizationId: string;
	tags?: Tag[];
}

export interface IOrganizationExpenseCategoryFindInput
	extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
}

export interface IOrganizationExpenseCategoryCreateInput {
	name: string;
	organizationId: string;
	tags?: Tag[];
}

export enum OrganizationExpenseCategoryEnum {
	SOFTWARE = 'Software',
	EMPLOYEES_BENEFITS = 'Employees Benefits',
	COURSES = 'Courses',
	SUBSCRIPTIONS = 'Subscriptions',
	RENT = 'Rent',
	SERVICE_FEE = 'Service Fee'
}
