import {
	IBasePerTenantAndOrganizationEntityModel,
	IProduct,
	IOrganizationProject,
	IEmployee,
	ITask,
	IInvoice,
	IExpense
} from '@gauzy/models';

export interface IInvoiceItem extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
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
	product?: IProduct;
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
	invoiceId: string;
	taskId?: string;
	employeeId?: string;
	projectId?: string;
	productId?: string;
	expenseId?: string;
	applyTax?: boolean;
	applyDiscount?: boolean;
}
