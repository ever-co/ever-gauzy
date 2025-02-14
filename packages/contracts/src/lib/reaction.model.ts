import { IBasePerTenantAndOrganizationEntityModel, ID, OmitFields } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';

/**
 * Reaction entity interface
 */
export interface IReaction extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	entity: ReactionEntityEnum;
	entityId: ID; // Indicate the ID of entity record reaction related to
	emoji: string;
}

/**
 * Reaction entity enum
 */
export enum ReactionEntityEnum {
	Comment = 'Comment',
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
