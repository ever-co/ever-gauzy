import { IBaseEntityModel } from './base-entity.model';

export interface IPasswordReset
	extends IBaseEntityModel {
	email: string;
	token: string;
	expired?: boolean;
}

export interface IPasswordResetFindInput
	extends IBaseEntityModel {
	email?: string;
	token?: string;
}

export interface IChangePasswordRequest { 
	token: string;
	password: string;
	confirmPassword: string;
}

export interface IResetPasswordRequest {
	email: string;
}