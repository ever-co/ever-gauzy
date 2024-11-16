import { IBaseEntityWithMembers } from './entity-with-members.model';
import { IEmployee } from './employee.model';
import { ITag } from './tag.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ICandidate } from './candidate.model';

export interface IOrganizationDepartment extends IBaseEntityWithMembers {
	name: string;
	tags?: ITag[];
	candidates?: ICandidate[];
}

export interface IOrganizationDepartmentFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
}

export interface IOrganizationDepartmentFindByMemberInput {
	memberId: string;
	tags?: ITag[];
}

export interface IOrganizationDepartmentCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	members?: IEmployee[];
	tags?: ITag[];
}
