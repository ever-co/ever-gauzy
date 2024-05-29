import { IBasePerTenantEntityModel } from './base-entity.model';
import { IRelationalUser, ProviderEnum } from './user.model';

export interface ISocialAccount extends IBasePerTenantEntityModel, IRelationalUser {
	provider: ProviderEnum;
	providerAccountId: string;
}

export interface ISocialAccountCreateInput extends ISocialAccount {}

export interface ISocialAccountUpdateInput
	extends Partial<Pick<ISocialAccountCreateInput, 'provider' | 'providerAccountId'>> {}
