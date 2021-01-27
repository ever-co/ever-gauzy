import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ILanguage, ILanguageFindInput } from './language.model';

export interface IOrganizationLanguages
	extends IBasePerTenantAndOrganizationEntityModel {
	language: ILanguage;
	languageId: string;
	level: string;
	name: string;
}

export interface IOrganizationLanguagesFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	language?: ILanguageFindInput;
	level?: string;
	name?: string;
}

export interface IOrganizationLanguagesCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	language: ILanguage;
	level: string;
	name: string;
}
