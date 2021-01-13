import { IBaseEntityModel } from './base-entity.model';
export interface ICountry extends IBaseEntityModel {
	isoCode: string;
	country: string;
}
