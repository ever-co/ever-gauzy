import { IBaseEntityWithMembers } from './entity-with-members.model';
import { IEmployee } from './employee.model';
import { ITag } from './tag-entity.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IOrganizationDepartment extends IBaseEntityWithMembers {
	name: string;
	tags: ITag[];
}

export interface IOrganizationDepartmentFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
}

export interface IOrganizationDepartmentFindByMemberInput {
	memberId: string;
	tags: ITag[];
}

export interface IOrganizationDepartmentCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	members?: IEmployee[];
	tags: ITag[];
}
