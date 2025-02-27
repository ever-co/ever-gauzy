import { ActorTypeEnum, BaseEntityEnum, IBasePerEntityType, ID, OmitFields } from './base-entity.model';
import { IEmployee, IEmployeeEntityInput as IMentionAuthor } from './employee.model';
import { IHasUserCreator } from './user.model';

export interface IMention extends IBasePerEntityType, IMentionAuthor, IHasUserCreator {
	actorType?: ActorTypeEnum;
	parentEntityId?: ID; // E.g : If the mention is in a comment, we need this for subscription and notifications purpose (It could be the task ID concerned by comment, then the user will be subscribed to that task instead of to a comment itself)
	parentEntityType?: BaseEntityEnum;
	mentionedEmployee?: IEmployee;
	mentionedEmployeeId?: ID;
}

export interface IMentionCreateInput extends OmitFields<IMention> {
	entityName?: string;
}

export interface IMentionEmployeeIds {
	mentionEmployeeIds?: ID[];
}
