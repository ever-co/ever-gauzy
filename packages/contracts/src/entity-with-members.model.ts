import { IEmployee } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag-entity.model';

export interface IBaseEntityWithMembers
	extends IBasePerTenantAndOrganizationEntityModel {
	members?: IEmployee[];
	name?: string;
	tags: ITag[];
}

export interface IEditEntityByMemberInput {
	addedEntityIds?: string[];
	removedEntityIds?: string[];
	member: IEmployee;
}
