import { IBasePerTenantEntityModel } from './base-entity.model';
import { IRelationalUser, ProviderEnum } from './user.model';

export interface ISocialAccountBase {
	provider: ProviderEnum;
	providerAccountId: string;
}

export interface ISocialAccount extends ISocialAccountBase, IBasePerTenantEntityModel, IRelationalUser {}

export interface ISocialAccountCreateInput extends ISocialAccount {}

export interface ISocialAccountUpdateInput
	extends Partial<Pick<ISocialAccountCreateInput, 'provider' | 'providerAccountId'>> {}
