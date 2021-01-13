import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmailTemplateFindInput } from '..';
import { IEmailTemplate } from './email-template.model';
import { IUser } from './user.model';

export interface IEmail extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	content: string;
	emailTemplate: IEmailTemplate;
	email: string;
	user?: IUser;
	isArchived?: boolean;
}

export interface IEmailUpdateInput {
	name?: string;
	content?: string;
	emailTemplate?: IEmailTemplate;
	email?: string;
	user?: IUser;
	isArchived?: boolean;
}

export interface IEmailFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	emailTemplate?: IEmailTemplateFindInput;
	// TODO! Maybe user here
	userId?: string;
	email?: string;
	isArchived?: boolean;
}

export interface DisplayEmail {
	from: string;
	to: string;
	date: string;
}
