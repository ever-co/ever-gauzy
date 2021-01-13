import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IExpenseCategory
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
}

export enum ExpenseCategoriesEnum {
	SOFTWARE = 'Software',
	EMPLOYEES_BENEFITS = 'Employees Benefits',
	COURSES = 'Courses',
	SUBSCRIPTIONS = 'Subscriptions',
	RENT = 'Rent',
	SERVICE_FEE = 'Service Fee'
}
