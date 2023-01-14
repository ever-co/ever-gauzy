import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";
import { IOrganizationProject } from "./organization-projects.model";

export interface IStatus extends IBasePerTenantAndOrganizationEntityModel {
    name: string;
    value: string;
    description?: string;
    icon?: string;
    color?: string;
	isSystem?: boolean;
    project?:  IOrganizationProject;
    projectId?:  IOrganizationProject['id'];
}

export interface IStatusCreateInput extends Omit<IStatus, 'isSystem'> {}

export interface IStatusUpdateInput extends Omit<IStatus, 'isSystem'> {
    id?: string;
}

export interface IStatusFindInput extends IBasePerTenantAndOrganizationEntityModel {
    projectId?: IOrganizationProject['id'];
}