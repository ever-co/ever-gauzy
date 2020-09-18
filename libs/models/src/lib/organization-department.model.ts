import { IBaseEntityWithMembers } from './entity-with-members.model';
import { IEmployee } from './employee.model';
import { ITag } from './tag-entity.model';

export interface IOrganizationDepartment extends IBaseEntityWithMembers {
	name: string;
	tags: ITag[];
}

export interface IOrganizationDepartmentFindInput {
	name?: string;
	organizationId?: string;
}

export interface IOrganizationDepartmentFindByMemberInput {
	memberId: string;
	tags: ITag[];
}

export interface IOrganizationDepartmentCreateInput {
	name: string;
	members?: IEmployee[];
	organizationId: string;
	tags: ITag[];
}
