import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ILanguage extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	code?: string;
	is_system?: boolean;
	description?: string;
	color?: string;
	isSelected?: boolean;
}

export interface ILanguageName {
	name?: string;
}

export interface ILanguageFindInput {
	name?: string;
	code?: string;
	is_system?: boolean;
	description?: string;
	color?: string;
}
