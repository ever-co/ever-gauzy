import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICustomSmtp extends IBasePerTenantAndOrganizationEntityModel {
	host: string;
	port: number;
	secure: boolean;
	username: string;
	password: string;
	isValidate?: boolean;
	fromAddress?: string;
}

export interface ICustomSmtpFindInput extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
}

export interface ICustomSmtpCreateInput extends ICustomSmtp { }

export interface IVerifySMTPTransport extends Omit<ICustomSmtpCreateInput, 'isValidate'> { }

export interface ICustomSmtpUpdateInput extends ICustomSmtpCreateInput { }

export enum SMTPSecureEnum {
	TRUE = 'True',
	FALSE = 'False'
}
