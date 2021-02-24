import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IAccountingTemplate
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	mjml?: string;
	languageCode: string;
	hbs?: string;
}

export interface IAccountingTemplateFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	languageCode?: string;
}

export enum AccountingTemplateNameEnum {
	INVOICE = 'invoice',
	ESTIMATE = 'estimate'
}
