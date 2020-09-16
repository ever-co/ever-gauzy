import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

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
}

export interface IInvoiceItemFindInput {
	invoiceId?: string;
}
