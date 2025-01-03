import { IEmployee, IEmployeeEntityInput } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { ITag } from './tag.model';
import { IExpenseCategory } from './expense-category.model';
import { IOrganizationVendor } from './organization-vendors.model';
import { IOrganizationProject } from './organization-projects.model';
import { IPaginationInput } from './core.model';
import { IOrganizationContact } from './organization-contact.model';

export interface IExpense extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	amount: number;
	vendor: IOrganizationVendor;
	vendorId: ID;
	typeOfExpense: string;
	category: IExpenseCategory;
	categoryId: ID;
	organizationContactId?: ID;
	organizationContact?: IOrganizationContact;
	projectId?: ID;
	project?: IOrganizationProject;
	notes?: string;
	valueDate?: Date;
	currency: string;
	purpose?: string;
	taxType?: string;
	taxLabel?: string;
	rateValue: number;
	receipt?: string;
	splitExpense: boolean;
	tags?: ITag[];
	status?: ExpenseStatusesEnum;
}

export interface IExpenseCreateInput extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	amount: number;
	typeOfExpense?: string;
	category: IExpenseCategory;
	vendor: IOrganizationVendor;
	organizationContactId?: ID;
	organizationContact?: IOrganizationContact;
	projectId?: ID;
	project?: IOrganizationProject;
	notes?: string;
	valueDate?: Date;
	currency?: string;
	purpose?: string;
	taxType?: string;
	taxLabel?: string;
	rateValue?: number;
	receipt?: string;
	splitExpense?: boolean;
	reference?: string;
	tags?: ITag[];
	status?: ExpenseStatusesEnum;
}

export interface IExpenseFindInput extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	vendorName?: string;
	vendorId?: string;
	typeOfExpense?: string;
	categoryName?: string;
	categoryId?: string;
	amount?: number;
	organizationContactId?: ID;
	organizationContact?: IOrganizationContact;
	projectId?: ID;
	project?: IOrganizationProject;
	notes?: string;
	valueDate?: Date;
	currency?: string;
	purpose?: string;
	taxType?: string;
	taxLabel?: string;
	rateValue?: number;
	receipt?: string;
	splitExpense?: boolean;
	tags?: ITag[];
	status?: ExpenseStatusesEnum;
}

export interface IExpenseUpdateInput extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	amount?: number;
	vendorName?: string;
	vendorId?: string;
	typeOfExpense?: string;
	category: IExpenseCategory;
	organizationContactId?: string;
	organizationContact?: IOrganizationContact;
	projectId?: string;
	project?: IOrganizationProject;
	notes?: string;
	valueDate?: Date;
	currency?: string;
	purpose?: string;
	taxType?: string;
	taxLabel?: string;
	rateValue?: number;
	receipt?: string;
	splitExpense?: boolean;
	tags?: ITag[];
	status?: ExpenseStatusesEnum;
}

export interface ISplitExpenseOutput extends IExpense {
	originalValue?: number;
	employeeCount?: number;
}

export interface ISplitExpenseFindInput {
	relations?: string[];
	filterDate?: string;
	employeeId: string;
}

export enum ExpenseTypesEnum {
	TAX_DEDUCTIBLE = 'TAX_DEDUCTIBLE',
	NOT_TAX_DEDUCTIBLE = 'NOT_TAX_DEDUCTIBLE',
	BILLABLE_TO_CONTACT = 'BILLABLE_TO_CONTACT'
}

export enum TaxTypesEnum {
	PERCENTAGE = 'PERCENTAGE',
	VALUE = 'VALUE'
}

export enum ExpenseStatusesEnum {
	INVOICED = 'INVOICED',
	UNINVOICED = 'UNINVOICED',
	PAID = 'PAID',
	NOT_BILLABLE = 'NOT_BILLABLE'
}

export interface IGetExpenseInput extends IPaginationInput, IBasePerTenantAndOrganizationEntityModel {
	onlyMe?: boolean;
	relations?: string[];
	types?: string[];
	titles?: string[];
	groupBy?: string;
	date?: Date | string;
	startDate?: Date | string;
	endDate?: Date | string;
	projectIds?: string[];
	employeeIds?: string[];
	categoryId?: string;
}

export interface IExpenseReportGroupByDate {
	date: string;
	employees: {
		employee: IEmployee;
		projects: {
			project: IOrganizationProject;
			expanse: IExpense;
			sum: number;
		}[];
	}[];
}

export interface IExpenseReportGroupByEmployee {
	employee: IEmployee;
	dates: {
		date: string;
		projects: {
			project: IOrganizationProject;
			expanse: IExpense;
			sum: number;
		}[];
	}[];
}

export interface IExpenseReportGroupByProject {
	project: IOrganizationProject;
	dates: {
		date: string;
		employees: {
			employee: IEmployee;
			expanse: IExpense;
			sum: number;
		}[];
	}[];
}

export type IExpenseReportData =
	| IExpenseReportGroupByDate
	| IExpenseReportGroupByEmployee
	| IExpenseReportGroupByProject;
