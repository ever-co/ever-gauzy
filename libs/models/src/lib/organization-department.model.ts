import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';

export interface OrganizationDepartment extends IBaseEntityModel {
    name: string;
    organization: Organization;
}

export interface OrganizationDepartmentFindInput extends IBaseEntityModel {
    name?: string;
    organizationid?: string;
}

export interface OrganizationDepartmentCreateInput {
    name: string;
    organizationid?: string;
}