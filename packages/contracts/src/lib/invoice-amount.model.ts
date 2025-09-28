import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IInvoice } from './invoice.model';

export interface IInvoiceAmount extends IBasePerTenantAndOrganizationEntityModel {
	totalValue?: number; // amount value
	currency?: string; // ISO currency code
	invoice?: IInvoice; // relation to invoice
	invoiceId?: string;
}
