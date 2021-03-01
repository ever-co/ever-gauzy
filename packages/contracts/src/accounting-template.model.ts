import { IOrganization } from 'index';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IAccountingTemplate
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	mjml?: string;
	languageCode: string;
	hbs?: string;
	templateType: string;
	organization?: IOrganization;
}

export interface IAccountingTemplateFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	languageCode?: string;
	templateType?: string;
}

export interface IAccountingTemplateUpdateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	languageCode?: string;
	templateType?: string;
	organization?: IOrganization;
}

export enum AccountingTemplateNameEnum {
	INVOICE = 'invoice',
	ESTIMATE = 'estimate',
	RECEIPT = 'receipt'
}

export enum AccountingTemplateTypeEnum {
	INVOICE = 'invoice',
	ESTIMATE = 'estimate',
	RECEIPT = 'receipt'
}
