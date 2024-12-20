import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IAccountingTemplate
	extends IAccountingTemplateUpdateInput {
	hbs?: string;
}

export interface IAccountingTemplateFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	languageCode?: string;
	templateType?: string;
}

export interface IAccountingTemplateUpdateInput
	extends IAccountingTemplateFindInput {
	mjml?: string;
}

export enum AccountingTemplateTypeEnum {
	INVOICE = 'invoice',
	ESTIMATE = 'estimate',
	RECEIPT = 'receipt'
}