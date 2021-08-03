import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import {
	IEmailTemplate,
	IEmailTemplateFindInput
} from './email-template.model';
import { IUser } from './user.model';

export interface IEmail 
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	content: string;
	email: string;
	isArchived?: boolean;
	user?: IUser;
	userId?: string;
	emailTemplate: IEmailTemplate;
	emailTemplateId: string;
}

export interface IEmailUpdateInput 
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	content?: string;
	email?: string;
	emailTemplate?: IEmailTemplate;
	emailTemplateId?: string;
	user?: IUser;
	userId?: string;
	isArchived?: boolean;
}

export interface IEmailFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	emailTemplate?: IEmailTemplateFindInput;
	emailTemplateId?: string;
	user?: IUser;
	userId?: string;
	email?: string;
	isArchived?: boolean;
}

export interface DisplayEmail {
	from: string;
	to: string;
	date: string;
}
