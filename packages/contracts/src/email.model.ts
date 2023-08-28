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
	isArchived?: boolean;
}

export interface IEmailUpdateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalUser, Partial<IRelationalEmailTemplate> {
	name?: string;
	content?: string;
	email?: string;
	isArchived?: boolean;
}

export interface IEmailFindInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalUser {
	emailTemplate?: IEmailTemplateFindInput;
	emailTemplateId?: string;
	email?: string;
	isArchived?: boolean;
}

export interface DisplayEmail {
	from: string;
	to: string;
	date: string;
}
