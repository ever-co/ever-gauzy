import { ActorTypeEnum, BaseEntityEnum, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';
import { IEmployee } from './employee.model';
import { IOrganizationTeam } from './organization-team.model';

export interface IComment extends IBasePerTenantAndOrganizationEntityModel {
	entity: BaseEntityEnum;
	entityId: ID; // Indicate the ID of entity record comment related to
	comment: string;
	creator?: IUser;
	creatorId?: ID; // The comment's user author ID
	actorType?: ActorTypeEnum;
	resolved?: boolean;
	resolvedAt?: Date;
	resolvedBy?: IUser;
	resolvedById?: ID;
	editedAt?: Date;
	members?: IEmployee[]; // Indicates members assigned to comment
	teams?: IOrganizationTeam[]; // Indicates teams assigned to comment
	parent?: IComment;
	parentId?: ID; // Specify the parent comment if current one is a reply
	replies?: IComment[];
}

export interface ICommentCreateInput {
	comment: string;
	entity: BaseEntityEnum;
	entityId: ID;
	parentId?: ID;
	members?: IEmployee[];
	teams?: IOrganizationTeam[];
}

export interface ICommentUpdateInput extends Partial<Omit<IComment, 'entity' | 'entityId' | 'creatorId' | 'creator'>> {}

export interface ICommentFindInput extends Pick<IComment, 'entity' | 'entityId'> {}
