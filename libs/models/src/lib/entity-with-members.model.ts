import { Employee } from './employee.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface BaseEntityWithMembers extends IBaseEntityModel {
	members?: Employee[];
	name?: string;
}

export interface EditEntityByMemberInput {
	addedEntityIds?: string[];
	removedEntityIds?: string[];
	member: Employee;
}
