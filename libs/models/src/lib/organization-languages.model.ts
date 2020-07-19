import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import {
	Language,
	LanguageFindInput,
	Organization,
	OrganizationFindInput
} from '@gauzy/models';

export interface OrganizationLanguages extends IBaseEntityModel {
	organization: Organization;
	organizationId: string;
	language: Language;
	languageId: string;
	level: string;
	name: string;
}

export interface OrganizationLanguagesFindInput extends IBaseEntityModel {
	language?: LanguageFindInput;
	organization?: OrganizationFindInput;
	organizationId?: string;
	level?: string;
	name?: string;
}

export interface OrganizationLanguagesCreateInput {
	language: Language;
	organization: Organization;
	level: string;
	name: string;
}
