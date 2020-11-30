import { IBaseEntityModel } from './base-entity.model';
export interface ICurrency extends IBaseEntityModel {
	isoCode: string;
	currency: string;
}
