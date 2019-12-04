import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Countries extends IBaseEntityModel {
	isoCode: string;
	country: string;
}
