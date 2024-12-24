import { IBasePerTenantEntityModel } from './base-entity.model';

export interface IPasswordReset extends IBasePerTenantEntityModel {
	email: string;
	token: string;
	expired?: boolean;
}

export interface IPasswordResetFindInput extends IBasePerTenantEntityModel {
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
