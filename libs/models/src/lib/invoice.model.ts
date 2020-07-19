import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { OrganizationContact } from './organization-contact.model';
import { InvoiceItem } from './invoice-item.model';
import { Tag } from './tag-entity.model';
import { Payment } from './payment.model';

export interface Invoice extends IBaseEntityModel {
	invoiceDate: Date;
	invoiceNumber: number;
	dueDate: Date;
	currency: string;
	discountValue: number;
	discountType: string;
	paid: boolean;
	tax: number;
	taxType: string;
	tax2: number;
	tax2Type: string;
	terms?: string;
	totalValue?: number;
	clientId?: string;
	organizationId?: string;
	fromOrganization?: Organization;
	toClient?: OrganizationContact;
	invoiceItems?: InvoiceItem[];
	invoiceType?: string;
	sentTo?: string;
	tags?: Tag[];
	isEstimate?: boolean;
	status?: string;
	payments?: Payment[];
	isAccepted?: boolean;
}

export interface InvoiceUpdateInput {
	invoiceDate?: Date;
	invoiceNumber?: number;
	dueDate?: Date;
	currency?: string;
	discountValue?: number;
	discountType?: string;
	paid?: boolean;
	tax?: number;
	tax2?: number;
	taxType?: string;
	tax2Type?: string;
	terms?: string;
	totalValue?: number;
	clientId?: string;
	organizationId?: string;
	invoiceType?: string;
	sentTo?: string;
	tags?: Tag[];
	status?: string;
	isAccepted?: boolean;
	isEstimate?: boolean;
}

export interface InvoiceFindInput {
	organizationId?: string;
	clientId?: string;
	invoiceId?: string;
	sentTo?: string;
	invoiceNumber?: string;
	tags?: Tag[];
	isEstimate?: boolean;
}

export enum InvoiceTypeEnum {
	BY_EMPLOYEE_HOURS = 'By Employee Hours',
	BY_PROJECT_HOURS = 'By Project Hours',
	BY_TASK_HOURS = 'By Task Hours',
	BY_PRODUCTS = 'By Products',
	DETAILS_INVOICE_ITEMS = 'Details Invoice Items'
}

export enum DiscountTaxTypeEnum {
	PERCENT = 'Percent',
	FLAT_VALUE = 'Flat'
}

export enum InvoiceStatusTypesEnum {
	DRAFT = 'Draft',
	SENT = 'Sent',
	VIEWED = 'Viewed',
	FULLY_PAID = 'Fully Paid',
	PARTIALLY_PAID = 'Partially Paid',
	OVERPAID = 'Overpaid',
	VOID = 'Void'
}

export enum EstimateStatusTypesEnum {
	DRAFT = 'Draft',
	SENT = 'Sent',
	VIEWED = 'Viewed',
	ACCEPTED = 'Accepted',
	REJECTED = 'Rejected',
	VOID = 'Void'
}

export enum InvoiceColumnsEnum {
	INVOICE_DATE = 'Invoice Date',
	DUE_DATE = 'Due Date',
	STATUS = 'Status',
	TOTAL_VALUE = 'Total Value',
	CURRENCY = 'Currency',
	TAX = 'Tax',
	TAX_2 = 'Tax 2',
	DISCOUNT = 'Discount',
	CLIENT = 'Client',
	PAID_STATUS = 'Paid Status'
}

export enum EstimateColumnsEnum {
	INVOICE_DATE = 'Invoice Date',
	DUE_DATE = 'Due Date',
	STATUS = 'Status',
	TOTAL_VALUE = 'Total Value',
	CURRENCY = 'Currency',
	TAX = 'Tax',
	TAX_2 = 'Tax 2',
	DISCOUNT = 'Discount',
	CLIENT = 'Client'
}
