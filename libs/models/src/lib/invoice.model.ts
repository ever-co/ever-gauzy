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
	sentStatus?: boolean;
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
	taxType?: string;
	terms?: string;
	totalValue?: number;
	clientId?: string;
	organizationId?: string;
	invoiceType?: string;
	sentTo?: string;
	tags?: Tag[];
	sentStatus?: boolean;
	isAccepted?: boolean;
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
