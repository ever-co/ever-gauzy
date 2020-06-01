import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Translation<T> extends IBaseEntityModel {
	reference?: Translatable<T>;
	languageCode: string;
}

export interface Translatable<T> extends IBaseEntityModel {
	translations?: Translation<T>[];
}
