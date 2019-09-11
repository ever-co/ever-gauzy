import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';

export interface OrganizationPositions extends IBaseEntityModel {
    name: string;
    organizationId: string;
}

export interface OrganizationPositionsFindInput extends IBaseEntityModel {
    name?: string;
    organizationId?: string;
}

export interface OrganizationPositionsCreateInput {
    name: string;
    organizationId: string;
}