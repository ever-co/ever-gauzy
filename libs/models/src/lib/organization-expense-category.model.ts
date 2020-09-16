import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag-entity.model';

export interface IOrganizationExpenseCategory
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	tags?: ITag[];
}

export interface IOrganizationExpenseCategoryFindInput {
	name?: string;
	organizationId?: string;
}

export interface IOrganizationExpenseCategoryCreateInput {
	name: string;
	organizationId: string;
	tags?: ITag[];
}

export enum OrganizationExpenseCategoryEnum {
	SOFTWARE = 'Software',
	EMPLOYEES_BENEFITS = 'Employees Benefits',
	COURSES = 'Courses',
	SUBSCRIPTIONS = 'Subscriptions',
	RENT = 'Rent',
	SERVICE_FEE = 'Service Fee'
}
