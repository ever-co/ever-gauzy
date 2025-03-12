import { IEmployee } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { ITaggable } from './tag.model';

export interface IBaseEntityWithMembers extends IBasePerTenantAndOrganizationEntityModel, ITaggable {
	members?: IEmployee[];
	name?: string;
}

export interface IEditEntityByMemberInput extends IBasePerTenantAndOrganizationEntityModel {
	addedEntityIds?: ID[];
	removedEntityIds?: ID[];
	member: IEmployee;
}
