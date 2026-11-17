import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

export interface IEstimateEmail
	extends IBasePerTenantAndOrganizationEntityModel {
	token?: string;
	email?: string;
	expireDate?: Date;
	convertAcceptedEstimates?: boolean;
	/**
	 * The invoice this email delivers, named when the email is created and taken back when it does not go. Only an
	 * invoice's email names it (an estimate's does not): the payment reminders go where the invoice went.
	 */
	invoiceId?: ID;
	/** The language the invoice was emailed in, named with `invoiceId`: its reminders are written in it. */
	languageCode?: string;
	/**
	 * When the mail transport took this email; unset while it has not. The row is written before the email is sent,
	 * so a row without it records an attempt, not a delivery.
	 */
	sentAt?: Date;
}

export interface IEstimateEmailFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	token?: string;
	email?: string;
}
