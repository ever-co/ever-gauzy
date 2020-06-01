import { Employee } from './employee.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tag } from './tag-entity.model';

export interface BaseEntityWithMembers extends IBaseEntityModel {
	members?: Employee[];
	name?: string;
	tags: Tag[];
}

export interface EditEntityByMemberInput {
	addedEntityIds?: string[];
	removedEntityIds?: string[];
	member: Employee;
}
