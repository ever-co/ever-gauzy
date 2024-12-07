import { IEmployee } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag.model';

export interface IBaseEntityWithMembers
	extends IBasePerTenantAndOrganizationEntityModel {
	members?: IEmployee[];
	name?: string;
	tags?: ITag[];
}

export interface IEditEntityByMemberInput extends IBasePerTenantAndOrganizationEntityModel {
	addedEntityIds?: string[];
	removedEntityIds?: string[];
	member: IEmployee;
}
