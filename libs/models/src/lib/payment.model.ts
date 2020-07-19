import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { Invoice } from './invoice.model';
import { ITenant } from './tenant.model';
import { Tag } from '..';
import { User } from './user.model';

export interface Payment extends IBaseEntityModel {
	invoice?: Invoice;
	invoiceId?: string;
	organization?: Organization;
	organizationId?: string;
	tenant?: ITenant;
	tags?: Tag[];
	note?: string;
	recordedBy?: User;
	userId?: string;
	paymentDate?: Date;
	amount?: number;
	currency?: string;
	overdue?: boolean;
	paymentMethod?: string;
}

export interface PaymentUpdateInput {
	amount?: number;
	note?: string;
	currency?: string;
	paymentDate?: Date;
}

export interface PaymentFindInput {
	invoiceId?: string;
	organizationId?: string;
}

export enum PaymentMethodEnum {
	BANK_TRANSFER = 'Bank transfer',
	CASH = 'Cash',
	CHEQUE = 'Cheque',
	CREDIT_CARD = 'Credit card',
	DEBIT = 'Debit',
	ONLINE = 'Online'
}
