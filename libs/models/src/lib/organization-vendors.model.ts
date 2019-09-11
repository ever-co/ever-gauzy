import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';

export interface OrganizationVendors extends IBaseEntityModel {
    name: string;
    organizationId: string;
}

export interface OrganizationVendorsFindInput extends IBaseEntityModel {
    name?: string;
    organizationId?: string;
}

export interface OrganizationVendorsCreateInput {
    name: string;
    organizationId: string;
}