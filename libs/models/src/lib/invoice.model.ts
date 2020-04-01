import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Invoice extends IBaseEntityModel {
	invoiceDate: Date;
	invoiceNumber: number;
	dueDate: Date;
	currency: string;
	discountValue: number;
	paid: boolean;
	tax: number;
	terms: string;
	totalValue: number;
}

export enum DiscountTypeEnum {
	PERCENTAGE = 'Percentage',
	VALUE = 'Value'
}
