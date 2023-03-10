import { IBaseEntityModel } from './base-entity.model';

export interface IEmailReset extends IBaseEntityModel {
	email: string;
	oldEmail: string;
	code: number;
	expired?: boolean;
	userId?: string;
	token: string;
}

export interface IEmailResetFindInput extends IBaseEntityModel {
	email?: string;
	oldEmail?: string;
	code?: number;
	userId?: string;
	token?: string;
}

export interface IChangeEmailRequest {
	code: number;
}

export interface IResetEmailRequest {
	email: string;
}
