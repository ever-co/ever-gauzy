import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICustomSmtp extends IBasePerTenantAndOrganizationEntityModel {
	host: string;
	port: number;
	secure: boolean;
	username: string;
	password: string;
	isValidate?: boolean;
}

export interface ICustomSmtpFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	id?: string;
}

export interface ICustomSmtpCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	host: string;
	port: number;
	secure: boolean;
	username: string;
	password: string;
}

export interface ICustomSmtpUpdateInput extends ICustomSmtpCreateInput {
	id: string;
}

export enum SMTPSecureEnum {
	TRUE = 'True',
	FALSE = 'False'
}
