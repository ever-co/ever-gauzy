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
	internalNote?: string;
	alreadyPaid?: number;
	amountDue?: number;
	hasRemainingAmountInvoiced?: boolean;
	publicLink?: string;
	token?: string;
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
	internalNote?: string;
	alreadyPaid?: number;
	amountDue?: number;
	hasRemainingAmountInvoiced?: boolean;
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
	BY_EMPLOYEE_HOURS = 'BY_EMPLOYEE_HOURS',
	BY_PROJECT_HOURS = 'BY_PROJECT_HOURS',
	BY_TASK_HOURS = 'BY_TASK_HOURS',
	BY_PRODUCTS = 'BY_PRODUCTS',
	BY_EXPENSES = 'BY_EXPENSES',
	DETAILED_ITEMS = 'DETAILED_ITEMS'
}

export enum DiscountTaxTypeEnum {
	PERCENT = 'PERCENT',
	FLAT_VALUE = 'FLAT'
}

export enum InvoiceStatusTypesEnum {
	DRAFT = 'DRAFT',
	SENT = 'SENT',
	VIEWED = 'VIEWED',
	FULLY_PAID = 'FULLY_PAID',
	PARTIALLY_PAID = 'PARTIALLY_PAID',
	OVERPAID = 'OVERPAID',
	VOID = 'VOID'
}

export enum EstimateStatusTypesEnum {
	DRAFT = 'DRAFT',
	SENT = 'SENT',
	VIEWED = 'VIEWED',
	ACCEPTED = 'ACCEPTED',
	REJECTED = 'REJECTED',
	VOID = 'VOID'
}

export enum InvoiceColumnsEnum {
	INVOICE_DATE = 'INVOICE_DATE',
	DUE_DATE = 'DUE_DATE',
	STATUS = 'STATUS',
	TOTAL_VALUE = 'TOTAL_VALUE',
	CURRENCY = 'CURRENCY',
	TAX = 'TAX',
	TAX_2 = 'TAX_2',
	DISCOUNT = 'DISCOUNT',
	CONTACT = 'CONTACT',
	PAID_STATUS = 'PAID_STATUS'
}

export enum EstimateColumnsEnum {
	ESTIMATE_DATE = 'ESTIMATE_DATE',
	DUE_DATE = 'DUE_DATE',
	STATUS = 'STATUS',
	TOTAL_VALUE = 'TOTAL_VALUE',
	CURRENCY = 'CURRENCY',
	TAX = 'TAX',
	TAX_2 = 'TAX_2',
	DISCOUNT = 'DISCOUNT',
	CONTACT = 'CONTACT'
}
