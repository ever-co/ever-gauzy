import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface IReaction extends IBasePerTenantAndOrganizationEntityModel {
	entity: ReactionEntityEnum;
	entityId: ID; // Indicate the ID of entity record reaction related to
	emoji: string;
	creator?: IUser;
	creatorId?: ID; // The reaction's employee author ID
}

export enum ReactionEntityEnum {
	Comment = 'Comment',
	Task = 'Task'
}

export interface IReactionCreateInput extends Omit<IReaction, 'creatorId'> {}

export interface IReactionUpdateInput extends Pick<IReaction, 'emoji'> {}
