import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { OrganizationClients } from './organization-clients.model';
import { Employee } from './employee.model';

export interface OrganizationProjects extends IBaseEntityModel {
    name: string;
    organizationId: string;
    client?: OrganizationClients;
    team?: Employee[];
}

export interface OrganizationProjectsFindInput extends IBaseEntityModel {
    name?: string;
    organizationId?: string;
    client?: OrganizationClients;
    team?: Employee[];
}

export interface OrganizationProjectsCreateInput {
    name: string;
    organizationId: string;
    client?: OrganizationClients;
    team?: Employee[];
}