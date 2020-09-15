import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IUser } from './user.model';
import { IInvoice } from './invoice.model';

export interface IInvoiceEstimateHistory
	extends IBasePerTenantAndOrganizationEntityModel {
	action: string;
	user: IUser;
	userId: string;
	invoice: IInvoice;
	invoiceId: string;
}

export interface IInvoiceEstimateHistoryFindInput {
	action?: string;
	userId?: string;
	invoiceId?: string;
	organizationId?: string;
}
