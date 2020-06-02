import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';
import { Employee } from './employee.model';
import { Tag } from './tag-entity.model';

export interface OrganizationDepartment extends IBaseEntityWithMembers {
	name: string;
	organizationId: string;
	tags: Tag[];
}

export interface OrganizationDepartmentFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
}

export interface OrganizationDepartmentFindByMemberInput
	extends IBaseEntityModel {
	memberId: string;
	tags: Tag[];
}

export interface OrganizationDepartmentCreateInput {
	name: string;
	members?: Employee[];
	organizationId: string;
	tags: Tag[];
}
