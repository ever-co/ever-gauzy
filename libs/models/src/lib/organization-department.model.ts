import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { BaseEntityWithMembers as IBaseEntityWithMembers } from './entity-with-members.model';

export interface OrganizationDepartment extends IBaseEntityWithMembers {
	name: string;
	organizationId: string;
}

export interface OrganizationDepartmentFindInput extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
}

export interface OrganizationDepartmentFindByMemberInput
	extends IBaseEntityModel {
	memberId: string;
}

export interface OrganizationDepartmentCreateInput {
	name: string;
	organizationId: string;
}
