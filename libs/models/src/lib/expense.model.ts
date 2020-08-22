import { Employee, EmployeeFindInput } from './employee.model';
import { Organization, OrganizationFindInput } from './organization.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tag } from './tag-entity.model';
import { IExpenseCategory } from './expense-category.model';
import { IOrganizationVendor } from '..';

export interface Expense extends IBaseEntityModel {
	employee?: Employee;
	employeeId?: string;
	organization: Organization;
	orgId: string;
	amount: number;
	vendor: IOrganizationVendor;
	vendorId: string;
	typeOfExpense?: string;
	category: IExpenseCategory;
	categoryId: string;
	organizationContactId?: string;
	organizationContactName?: string;
	projectId?: string;
	projectName?: string;
	notes?: string;
	valueDate?: Date;
	currency: string;
	purpose?: string;
	taxType?: string;
	taxLabel?: string;
	rateValue?: number;
	receipt?: string;
	splitExpense?: boolean;
	tags?: Tag[];
	status?: string;
}

export interface ExpenseCreateInput {
	employeeId?: string;
	amount: number;
	typeOfExpense?: string;
	category: IExpenseCategory;
	vendor: IOrganizationVendor;
	organizationContactId?: string;
	organizationContactName?: string;
	projectId?: string;
	projectName?: string;
	notes?: string;
	valueDate: Date;
	currency?: string;
	orgId?: string;
	purpose?: string;
	taxType?: string;
	taxLabel?: string;
	rateValue?: number;
	receipt?: string;
	splitExpense?: boolean;
	reference?: string;
	tags?: Tag[];
	status?: string;
}

export interface ExpenseFindInput extends IBaseEntityModel {
	employee?: EmployeeFindInput;
	organization?: OrganizationFindInput;
	vendorName?: string;
	vendorId?: string;
	typeOfExpense?: string;
	categoryName?: string;
	categoryId?: string;
	amount?: number;
	organizationContactId?: string;
	organizationContactName?: string;
	projectId?: string;
	projectName?: string;
	notes?: string;
	valueDate?: Date;
	currency?: string;
	purpose?: string;
	taxType?: string;
	taxLabel?: string;
	rateValue?: number;
	receipt?: string;
	splitExpense?: boolean;
	tags?: Tag[];
	status?: string;
}

export interface ExpenseUpdateInput {
	employeeId?: string;
	orgId?: string;
	amount?: number;
	vendorName?: string;
	vendorId?: string;
	typeOfExpense?: string;
	category: IExpenseCategory;
	organizationContactId?: string;
	organizationContactName?: string;
	projectId?: string;
	projectName?: string;
	notes?: string;
	valueDate?: Date;
	currency?: string;
	purpose?: string;
	taxType?: string;
	taxLabel?: string;
	rateValue?: number;
	receipt?: string;
	splitExpense?: boolean;
	tags?: Tag[];
	status?: string;
}

export interface SplitExpenseOutput extends Expense {
	originalValue?: number;
	employeeCount?: number;
}

export interface SplitExpenseFindInput {
	relations?: string[];
	filterDate?: string;
	employeeId: string;
}

export enum ExpenseTypesEnum {
	TAX_DEDUCTIBLE = 'Tax Deductible',
	NOT_TAX_DEDUCTIBLE = 'Not Tax Deductible',
	BILLABLE_TO_CONTACT = 'Billable to Contact'
}

export enum TaxTypesEnum {
	PERCENTAGE = 'Percentage',
	VALUE = 'Value'
}

export enum ExpenseStatusesEnum {
	INVOICED = 'Invoiced',
	UNINVOICED = 'Uninvoiced',
	PAID = 'Paid'
}
