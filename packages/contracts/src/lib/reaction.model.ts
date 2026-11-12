import { ActorTypeEnum, BaseEntityEnum, IBasePerTenantAndOrganizationEntityModel, ID, OmitFields } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

/**
 * Reaction entity interface
 */
export interface IReaction extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	entity: ReactionEntityEnum;
	entityId: ID; // Indicate the ID of entity record reaction related to
	emoji: string;
	actorType?: ActorTypeEnum; // Will be stored as 0 or 1 in DB
}

/**
 * Reaction entity enum
 */
export enum ReactionEntityEnum {
	Broadcast = 'Broadcast',
	ChatMessage = 'ChatMessage',
	Comment = 'Comment',
	Document = 'Document',
	Task = 'Task'
}

/**
 * Reaction create input interface
 */
export interface IReactionCreateInput extends OmitFields<IReaction, 'employee' | 'employeeId'> {}

/**
 * Reaction update input interface
 */
export interface IReactionUpdateInput extends IBasePerTenantAndOrganizationEntityModel, Pick<IReaction, 'emoji'> {}

/**
 * The record whose comments' reactions are summarized (`GET /reaction/comments`): a task, a document, a contact…
 */
export interface ICommentReactionsFindInput extends IBasePerTenantAndOrganizationEntityModel {
	entity: BaseEntityEnum;
	entityId: ID;
}

/** Someone who reacted with an emoji, as a reader of the comment sees them. */
export interface IReactionSummaryReactor {
	employeeId: ID;
	name: string;
	imageUrl?: string | null;
}

/**
 * The reactions of one emoji on one record (a comment): how many, who (in the order they reacted), and whether
 * the caller is one of them, with their reaction's id when they are.
 */
export interface IReactionSummary {
	entity: ReactionEntityEnum;
	entityId: ID;
	emoji: string;
	count: number;
	reactedByMe: boolean;
	reactionId?: ID | null;
	reactors: IReactionSummaryReactor[];
}
