import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ITranslation<T>
	extends IBasePerTenantAndOrganizationEntityModel {
	reference?: ITranslatable<T>;
	languageCode: string;
}

export interface ITranslatable<T>
	extends IBasePerTenantAndOrganizationEntityModel {
	translations?: ITranslation<T>[];
}

//tstodo new models
export interface IITranslation<
	T extends IBasePerTenantAndOrganizationEntityModel
> extends IBasePerTenantAndOrganizationEntityModel {
	reference?: T;
	languageCode: string;
}

export interface IITranslatable<
	T extends IBasePerTenantAndOrganizationEntityModel
> extends IBasePerTenantAndOrganizationEntityModel {
	translations: T[];
}
