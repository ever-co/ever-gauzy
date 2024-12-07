import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ILanguage, ILanguageFindInput } from './language.model';

export interface IOrganizationLanguage
	extends IBasePerTenantAndOrganizationEntityModel {
	language: ILanguage;
	languageCode: string;
	level: string;
	name: string;
}

export interface IOrganizationLanguageFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	language?: ILanguageFindInput;
	level?: string;
	name?: string;
}

export interface IOrganizationLanguageCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	language: ILanguage;
	level: string;
	name: string;
}
