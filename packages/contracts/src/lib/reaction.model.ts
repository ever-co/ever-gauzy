import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';
import { IUser } from './user.model';

export interface IReaction extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	entity: ReactionEntityEnum;
	entityId: ID; // Indicate the ID of entity record reaction related to
	emoji: string;
	createdBy?: IUser;
	createdById?: ID; // The reaction's employee author ID
}

export enum ReactionEntityEnum {
	Comment = 'Comment',
	Task = 'Task'
}

export interface IReactionCreateInput extends Omit<IReaction, 'createdById' | 'employeeId'> {}

export interface IReactionUpdateInput extends Pick<IReaction, 'emoji'> {}
