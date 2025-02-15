import { ActorTypeEnum, IBasePerEntityType, JsonData, OmitFields } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

/**
 * Interface representing an activity log entry.
 */
export interface IActivityLog extends IEmployeeEntityInput, IBasePerEntityType {
	action: ActionTypeEnum;
	actorType?: ActorTypeEnum;
	description?: string; // A short sentence describing the action performed. (E.g John Doe created this on 22.09.2024)
	updatedFields?: string[]; // In case of update actions, which entity fields was modified simultaneously. Avoid multiple records. (E.g For task : ['name', 'members', 'projectId'])
	previousValues?: IActivityLogUpdatedValues[]; // Values before update (E.g For task : {title: ' First Task', members: ['Member1Name', 'Member2Name'], projectId: 'project1UUId'})
	updatedValues?: IActivityLogUpdatedValues[]; // Values after update (E.g For task : {title: ' First Task Updated', members: ['Member4Name', 'Member3Name'], projectId: 'project2UUId'})
	previousEntities?: IActivityLogUpdatedValues[]; // Stores previous IDs or other values for related entities. Eg : {members: ['member_1_ID', 'member_2_ID']}
	updatedEntities?: IActivityLogUpdatedValues[]; // Stores updated IDs, or other values for related entities. Eg : {members: ['member_1_ID', 'member_2_ID']},
	data?: JsonData;
}

export interface IActivityLogUpdatedValues {
	[x: string]: Record<string, any>;
}

/**
 * Enum for action types in the activity log.
 */
export enum ActionTypeEnum {
	Created = 'Created',
	Updated = 'Updated',
	Deleted = 'Deleted'
}

/**
 * Input type for activity log creation, excluding `employeeId` and `employee`.
 */
export interface IActivityLogInput extends OmitFields<IActivityLog, 'employeeId' | 'employee'> {}
