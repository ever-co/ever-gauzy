import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IExpense } from './expense.model';
import { IInvoice } from './invoice.model';
import { IOrganizationProject } from './organization-projects.model';
import { IProductTranslatable } from './product.model';
import { ITask } from './task.model';

export interface IInvoiceItem extends IBasePerTenantAndOrganizationEntityModel {
	description: string;
	price: number;
	quantity: number;
	totalValue: number;
	invoiceId?: string;
	taskId?: string;
	employeeId?: string;
	projectId?: string;
	productId?: string;
	expenseId?: string;
	applyTax?: boolean;
	applyDiscount?: boolean;
	product?: IProductTranslatable;
	project?: IOrganizationProject;
	employee?: IEmployee;
	task?: ITask;
	invoice?: IInvoice;
	expense?: IExpense;
}

export interface IInvoiceItemFindInput {
	invoiceId?: string;
}

export interface IInvoiceItemCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	description: string;
	price: number;
	quantity: number;
	totalValue: number;
	invoiceId?: string;
	taskId?: string;
	employeeId?: string;
	projectId?: string;
	productId?: string;
	expenseId?: string;
	applyTax?: boolean;
	applyDiscount?: boolean;
}
