import { IBaseEntityModel } from './base-entity.model';

export interface IPasswordReset
	extends IBaseEntityModel {
	email: string;
	token: string;
}