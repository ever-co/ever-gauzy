import { IBaseEntityModel } from './base-entity.model';

export interface IEmailReset
	extends IBaseEntityModel {
	oldEmail: string;
	newEmail: string;
	token: string;
	code: number;
	expired?: boolean;
	userId?: string;
}

export interface IEmailResetFindInput
	extends IBaseEntityModel {
	email?: string;
	token?: string;
	code?: number;
}

export interface IChangeEmailRequest { 
	token: string;
	code: number;
}

export interface IResetEmailRequest {
	email: string;
}
