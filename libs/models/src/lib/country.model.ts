import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Country extends IBaseEntityModel {
	isoCode: string;
	country: string;
}
