import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import {
	IEmailTemplateFindInput,
	IRelationalEmailTemplate
} from './email-template.model';
import { IRelationalUser } from './user.model';

export interface IEmailHistory extends IBasePerTenantAndOrganizationEntityModel, IRelationalUser, IRelationalEmailTemplate {
	name: string;
	content: string;
	email: string;
	status?: EmailStatusEnum;
}

export interface IEmailUpdateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalUser, Partial<IRelationalEmailTemplate> {
	name?: string;
	content?: string;
	email?: string;
	isArchived?: boolean;
}

export interface IResendEmailInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalUser, Partial<IRelationalEmailTemplate> {
	id: IEmailHistory['id'];
	[x: string]: any;
}

export interface IEmailFindInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalUser {
	emailTemplate?: IEmailTemplateFindInput;
	emailTemplateId?: string;
	email?: string;
	isArchived?: boolean;
	status?: EmailStatusEnum;
}

export interface DisplayEmail {
	from: string;
	to: string;
	date: string;
}

export enum EmailStatusEnum {
	SENT = 'SENT',
	FAILED = 'FAILED'
}
