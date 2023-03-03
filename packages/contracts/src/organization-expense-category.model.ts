import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag.model';

export interface IOrganizationExpenseCategory
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	tags?: ITag[];
}

export interface IOrganizationExpenseCategoryFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	organizationId?: string;
}

export interface IOrganizationExpenseCategoryCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
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
