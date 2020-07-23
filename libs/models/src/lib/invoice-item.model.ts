import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface InvoiceItem extends IBaseEntityModel {
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

export interface InvoiceItemFindInput {
	invoiceId?: string;
}
