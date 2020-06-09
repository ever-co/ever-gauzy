import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { LanguagesEnum } from './user.model';

export interface EmailTemplate extends IBaseEntityModel {
	name: string;
	mjml?: string;
	hbs: string;
	languageCode: string;
}

export interface EmailTemplateFindInput extends IBaseEntityModel {
	name?: string;
	languageCode?: string;
}

export enum EmailTemplateNameEnum {
	PASSWORD_RESET = 'password',
	WELCOME_USER = 'welcome-user',
	INVITE_ORGANIZATION_CLIENT = 'invite-organization-client',
	INVITE_EMPLOYEE = 'invite-employee',
	INVITE_USER = 'invite-user',
	EMAIL_INVOICE = 'email-invoice',
	EMAIL_ESTIMATE = 'email-estimate'
}

export interface ICustomizeEmailTemplateFindInput {
	name: EmailTemplateNameEnum;
	languageCode: LanguagesEnum;
	organizationId: string;
}

export interface ICustomizableEmailTemplate {
	template: string;
	subject: string;
}

export interface IEmailTemplateSaveInput
	extends ICustomizeEmailTemplateFindInput {
	mjml: string;
	subject: string;
}
