import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganization } from './organization.model';
import { IOrganizationContact } from './organization-contact.model';
import { IInvoiceItem } from './invoice-item.model';
import { ITag } from './tag-entity.model';
import { IPayment } from './payment.model';
import { IInvoiceEstimateHistory } from './invoice-estimate-history.model';

export interface IInvoice extends IBasePerTenantAndOrganizationEntityModel {
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
	organizationContactId?: string;
	organizationContactName?: string;
	fromOrganization?: IOrganization;
	toContact?: IOrganizationContact;
	invoiceItems?: IInvoiceItem[];
	invoiceType?: string;
	sentTo?: string;
	tags?: ITag[];
	isEstimate?: boolean;
	status?: string;
	payments?: IPayment[];
	isAccepted?: boolean;
	historyRecords?: IInvoiceEstimateHistory[];
}

export interface IInvoiceCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
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
	organizationContactId?: string;
	organizationContactName?: string;
	fromOrganization?: IOrganization;
	toContact?: IOrganizationContact;
	invoiceType?: string;
	sentTo?: string;
	tags?: ITag[];
	status?: string;
	isAccepted?: boolean;
	isEstimate?: boolean;
}

export interface IInvoiceUpdateInput extends IInvoiceCreateInput {
	id?: string;
}
export interface IInvoiceFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	organizationContactId?: string;
	invoiceId?: string;
	sentTo?: string;
	invoiceNumber?: string;
	tags?: ITag[];
	isEstimate?: boolean;
}

export enum InvoiceTypeEnum {
	BY_EMPLOYEE_HOURS = 'By Employee Hours',
	BY_PROJECT_HOURS = 'By Project Hours',
	BY_TASK_HOURS = 'By Task Hours',
	BY_PRODUCTS = 'By Products',
	BY_EXPENSES = 'By Expenses',
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
	CONTACT = 'Contact',
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
	CONTACT = 'Contact'
}
