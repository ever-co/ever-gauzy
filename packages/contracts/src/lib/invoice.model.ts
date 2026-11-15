import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IOrganization } from './organization.model';
import { IOrganizationContact } from './organization-contact.model';
import { IInvoiceItem } from './invoice-item.model';
import { ITag } from './tag.model';
import { IPayment } from './payment.model';
import { IInvoiceEstimateHistory } from './invoice-estimate-history.model';

/**
 * Interface representing invoice statistics.
 */
export interface InvoiceStats {
	count: number; // The count of invoices
	amount: number; // The total amount of all invoices
}

export interface IInvoice extends IBasePerTenantAndOrganizationEntityModel {
	invoiceDate: Date;
	invoiceNumber: number;
	dueDate: Date;
	currency: string;
	discountValue: number;
	discountType: DiscountTaxTypeEnum;
	paid: boolean;
	tax: number;
	taxType: DiscountTaxTypeEnum;
	tax2: number;
	tax2Type: DiscountTaxTypeEnum;
	/** How the second tax combines with the first; absent (older invoices) means SIMPLE. */
	taxCalculationType?: TaxCalculationTypeEnum;
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
	token?: string;
	/**
	 * When another document's line first billed time this void invoice or rejected estimate had released: from then on
	 * it keeps its status, since making it live again would charge that time twice. Written by the API only.
	 */
	releasedTimeBilledAt?: Date | null;
}

export interface IInvoiceCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	invoiceDate?: Date;
	invoiceNumber?: number;
	dueDate?: Date;
	currency?: string;
	discountValue?: number;
	discountType?: DiscountTaxTypeEnum;
	paid?: boolean;
	tax?: number;
	tax2?: number;
	taxType?: DiscountTaxTypeEnum;
	tax2Type?: DiscountTaxTypeEnum;
	taxCalculationType?: TaxCalculationTypeEnum;
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
	isArchived?: boolean;
}

export interface IInvoiceUpdateInput extends IInvoiceCreateInput {
	id?: string;
	internalNote?: string;
	alreadyPaid?: number;
	amountDue?: number;
	hasRemainingAmountInvoiced?: boolean;
	isArchived?: boolean;
}
export interface IInvoiceFindInput extends IBasePerTenantAndOrganizationEntityModel {
	organizationContactId?: string;
	invoiceId?: string;
	sentTo?: string;
	invoiceNumber?: string;
	tags?: ITag[];
	isEstimate?: boolean | number;
	isArchived?: boolean;
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

export type InvoiceStatusEnumType = InvoiceStatusTypesEnum | EstimateStatusTypesEnum;

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

export enum InvoiceTabsEnum {
	ACTIONS = 'ACTIONS',
	SEARCH = 'SEARCH',
	HISTORY = 'HISTORY'
}

export enum TaxCalculationTypeEnum {
	SIMPLE = 'SIMPLE',
	COMPOSED = 'COMPOSED'
}

/**
 * A payment reminder the platform emailed the client of an unpaid invoice, when the organization turned them on: one
 * row per invoice, step and due date. Step 1 goes three days before the due date, steps 2, 3 and 4 one, seven and
 * fourteen days after it. The row is the claim the sweep takes before it sends, so each reminder goes once.
 */
export interface IInvoiceReminder extends IBasePerTenantAndOrganizationEntityModel {
	invoice?: IInvoice;
	invoiceId: ID;
	/** 1: before the due date; 2, 3, 4: one, seven and fourteen days after it. */
	step: number;
	/** The due date the step was counted from: a due date moved since starts the steps again. */
	dueDate: Date;
	/** Where the reminder went: the address the invoice was last emailed to. */
	email: string;
	/** When the sweep claimed it. */
	claimedAt: Date;
	/** When the mail transport took it; unset while it did not (an address of a domain the platform never emails). */
	sentAt?: Date;
}
