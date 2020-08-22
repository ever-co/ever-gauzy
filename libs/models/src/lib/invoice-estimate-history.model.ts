import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { User } from './user.model';
import { Invoice } from './invoice.model';
import { Organization } from './organization.model';

export interface InvoiceEstimateHistory extends IBaseEntityModel {
	action: string;
	user: User;
	userId: string;
	invoice: Invoice;
	invoiceId: string;
	organization: Organization;
	organizationId: string;
}

export interface InvoiceEstimateHistoryFindInput {
	action?: string;
	userId?: string;
	invoiceId?: string;
	organizationId?: string;
}
