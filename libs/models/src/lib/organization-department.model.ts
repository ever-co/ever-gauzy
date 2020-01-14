import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';

export interface OrganizationDepartment extends IBaseEntityModel {
	name: string;
	organizationId: string;
	members?: Employee[];
}

export interface OrganizationDepartmentFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
}

export interface OrganizationDepartmentCreateInput {
	name: string;
	organizationId: string;
}
