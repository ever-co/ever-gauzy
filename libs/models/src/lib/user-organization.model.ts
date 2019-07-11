import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface UserOrganization extends IBaseEntityModel {
    userId: string;
    orgId: string;
    isDefault: boolean;
    isActive: boolean;
}

export interface UserOrganizationFindInput extends IBaseEntityModel {
    userId?: string;
    orgId?: string;
    isDefault?: boolean;
    isActive?: boolean;
}

export interface UserOrganizationCreateInput {
    userId: string;
    orgId: string;
    isDefault?: boolean;
    isActive?: boolean;
}