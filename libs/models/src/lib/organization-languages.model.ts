import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import {
	ILanguage,
	ILanguageFindInput,
	IOrganization,
	IOrganizationFindInput
} from '@gauzy/models';

export interface IOrganizationLanguages
	extends IBasePerTenantAndOrganizationEntityModel {
	language: ILanguage;
	languageId: string;
	level: string;
	name: string;
}

export interface IOrganizationLanguagesFindInput {
	language?: ILanguageFindInput;
	organization?: IOrganizationFindInput;
	organizationId?: string;
	level?: string;
	name?: string;
}

export interface IOrganizationLanguagesCreateInput {
	language: ILanguage;
	organization: IOrganization;
	level: string;
	name: string;
}
