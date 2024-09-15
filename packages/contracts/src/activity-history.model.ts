import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface IActivityHistory extends IBasePerTenantAndOrganizationEntityModel {
	entity: ActivityEntityEnum; // Entity / Table name concerned by activity log
	entityId: ID; // The ID of the element we are interacting with (a task, an organization, an employee, ...)
	action: ActivityHistoryAction;
	description?: string; // A short sentence describing the action performed
	updatedProperties?: string[]; // In case of update actions, which entity properties was modified simultaneously. Avoid multiple records. E.g For task : ['name', 'members', 'projectId']
	previousValues?: IActivityHistoryUpdatedValues[]; // E.g For task : {title: ' First Task', members: ['Member1Name', 'Member2Name'], projectId: 'project1UUId'}
	updatedValues?: IActivityHistoryUpdatedValues[]; // E.g For task : {title: ' First Task Updated', members: ['Member4Name', 'Member3Name'], projectId: 'project2UUId'}
	previousEntities?: IActivityHistoryUpdatedValues[]; // Stores previous IDs or other values for related entities. Eg : {members: ['member_1_ID', 'member_2_ID']}
	updatedEntities?: IActivityHistoryUpdatedValues[]; // Stores updated IDs, or other values for related entities. Eg : {members: ['member_1_ID', 'member_2_ID']},
	creator?: IUser;
	creatorId?: ID;
	details?: ActivityHistoryDetails;
}

export type ActivityHistoryAction = 'creation' | 'modification' | 'deletion'; // User, Organization,... action

export interface IActivityHistoryUpdatedValues {
	[x: string]: any;
}

export type ActivityHistoryDetails = IActivityHistoryUpdatedValues;

export enum ActivityEntityEnum {
	Candidate = 'Candidate',
	Contact = 'Contact',
	Employee = 'Employee',
	Expense = 'Expense',
	DailyPlan = 'DailyPlan',
	Invoice = 'Invoice',
	Income = 'Income',
	Organization = 'Organization',
	OrganizationContact = 'OrganizationContact',
	OrganizationDepartment = 'OrganizationDepartment',
	OrganizationDocument = 'OrganizationDocument',
	OrganizationProject = 'OrganizationProject',
	OrganizationTeam = 'OrganizationTeam',
	OrganizationProjectModule = 'OrganizationProjectModule',
	OrganizationSprint = 'OrganizationSprint',
	Task = 'Task',
	User = 'User'
	// Add other entities as we can to use them for activity history
}
