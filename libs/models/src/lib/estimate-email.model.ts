import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface EstimateEmail extends IBaseEntityModel {
	token?: string;
	email?: string;
	expireDate?: Date;
}

export interface EstimateEmailFindInput {
	token?: string;
	email?: string;
}
