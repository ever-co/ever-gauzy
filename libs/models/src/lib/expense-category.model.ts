import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface IExpenseCategory extends IBaseEntityModel {
	name: string;
	organizationId: string;
	organization?: Organization;
	tenant: ITenant;
}

export enum ExpenseCategoriesEnum {
	SOFTWARE = 'Software',
	EMPLOYEES_BENEFITS = 'Employees Benefits',
	COURSES = 'Courses',
	SUBSCRIPTIONS = 'Subscriptions',
	RENT = 'Rent',
	SERVICE_FEE = 'Service Fee'
}
