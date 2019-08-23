import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';

export interface OrganizationDepartment extends IBaseEntityModel {
    name: string;
    organization: Organization;
}

export interface OrganizationDepartmentFindInput extends IBaseEntityModel {
    name?: string;
    valueDate?: Date;
    imageUrl?: string;
}

export interface OrganizationDepartmentCreateInput {
    name: string;
    valueDate?: Date;
    imageUrl: string;
}