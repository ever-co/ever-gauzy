import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IUser } from './user.model';
import { IInvoice } from './invoice.model';

export interface IInvoiceEstimateHistory
	extends IBasePerTenantAndOrganizationEntityModel {
	action: string;
	title?: string;
	user: IUser;
	userId: string;
	invoice: IInvoice;
	invoiceId: string;
}

export interface IInvoiceEstimateHistoryFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	action?: string;
	title?: string;
	userId?: string;
	invoiceId?: string;
	organizationId?: string;
}
