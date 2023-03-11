import { IBasePerTenantEntityModel } from './base-entity.model';
import { IRelationalUser, IUserCodeInput, IUserEmailInput, IUserTokenInput } from './user.model';

export interface IEmailReset extends IEmailResetCreateInput {
	expiredAt?: Date;
	isExpired?: boolean;
}

export interface IEmailResetFindInput extends Partial<IEmailResetCreateInput> { }

export interface IEmailResetCreateInput extends IBasePerTenantEntityModel, IRelationalUser, IUserEmailInput, IUserCodeInput, IUserTokenInput {
	oldEmail: string;
}
