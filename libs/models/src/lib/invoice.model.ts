import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { OrganizationClients } from './organization-clients.model';
import { InvoiceItem } from './invoice-item.model';

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
	toClient?: OrganizationClients;
	invoiceItems?: InvoiceItem[];
	invoiceType?: string;
	sentTo?: string;
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
}

export interface InvoiceFindInput {
	organizationId?: string;
	clientId?: string;
	invoiceId?: string;
	sentTo?: string;
	invoiceNumber?: string;
}

export enum InvoiceTypeEnum {
	BY_EMPLOYEE_HOURS = 'By Employee Hours',
	BY_PROJECT_HOURS = 'By Project Hours',
	BY_TASK_HOURS = 'By Task Hours',
	DETAILS_INVOICE_ITEMS = 'Details Invoice Items'
}

export enum DiscountTaxTypeEnum {
	PERCENT = 'Percent',
	FLAT_VALUE = 'Flat'
}
