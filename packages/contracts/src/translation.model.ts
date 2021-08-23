import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ITranslation<T>
	extends IBasePerTenantAndOrganizationEntityModel {
	reference?: ITranslatable<T>;
	referenceId?: string;
	languageCode: string;
}

export interface ITranslatable<T>
	extends IBasePerTenantAndOrganizationEntityModel {
	translations?: ITranslation<T>[];
}
