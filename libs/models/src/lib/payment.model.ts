import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IInvoice } from './invoice.model';
import { ITag } from './tag-entity.model';
import { IUser } from './user.model';
import { IOrganizationContact } from './organization-contact.model';
import { IOrganizationProject } from './organization-projects.model';

export interface IPayment extends IBasePerTenantAndOrganizationEntityModel {
	invoice?: IInvoice;
	invoiceId?: string;
	tags?: ITag[];
	note?: string;
	recordedBy?: IUser;
	employeeId?: string;
	paymentDate?: Date;
	amount?: number;
	currency?: string;
	overdue?: boolean;
	paymentMethod?: string;
	contact?: IOrganizationContact;
	contactId?: string;
	project?: IOrganizationProject;
	projectId?: string;
}

export interface IPaymentUpdateInput {
	amount?: number;
	note?: string;
	currency?: string;
	paymentDate?: Date;
}

export interface IPaymentFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	invoiceId?: string;
}

export enum PaymentMethodEnum {
	BANK_TRANSFER = 'Bank transfer',
	CASH = 'Cash',
	CHEQUE = 'Cheque',
	CREDIT_CARD = 'Credit card',
	DEBIT = 'Debit',
	ONLINE = 'Online'
}
