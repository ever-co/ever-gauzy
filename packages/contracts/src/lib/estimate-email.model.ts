import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export interface IEstimateEmail
	extends IBasePerTenantAndOrganizationEntityModel {
	token?: string;
	email?: string;
	expireDate?: Date;
	convertAcceptedEstimates?: boolean;
	/**
	 * The invoice this email delivered, recorded once the mail transport took it. Only an invoice's email records it
	 * (an estimate's does not): the payment reminders go where the invoice went.
	 */
	invoiceId?: ID;
	/** The language the invoice was emailed in, recorded with `invoiceId`: its reminders are written in it. */
	languageCode?: string;
}

export interface IEstimateEmailFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	token?: string;
	email?: string;
}
