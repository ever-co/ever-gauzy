import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IExpense } from './expense.model';
import { ITag } from './tag-entity.model';

export interface IExpenseCategory
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	tags?: ITag[];
	expenses?: IExpense[];
}

export enum ExpenseCategoriesEnum {
	SOFTWARE = 'Software',
	EMPLOYEES_BENEFITS = 'Employees Benefits',
	COURSES = 'Courses',
	SUBSCRIPTIONS = 'Subscriptions',
	RENT = 'Rent',
	SERVICE_FEE = 'Service Fee'
}
