import { ActorTypeEnum, IBasePerEntityType, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';
import { IEmployee, IEmployeeEntityInput } from './employee.model';
import { IOrganizationTeam } from './organization-team.model';
import { IMentionEmployeeIds } from './mention.model';

export interface IComment extends IBasePerTenantAndOrganizationEntityModel, IBasePerEntityType, IEmployeeEntityInput {
	comment: string;
	actorType?: ActorTypeEnum;
	resolved?: boolean;
	resolvedAt?: Date;
	resolvedBy?: IEmployee;
	resolvedById?: ID;
	editedAt?: Date;
	members?: IEmployee[]; // Indicates members assigned to comment
	teams?: IOrganizationTeam[]; // Indicates teams assigned to comment
	parent?: IComment;
	parentId?: ID; // Specify the parent comment if current one is a reply
	replies?: IComment[];

	createdBy?: IUser;
	createdById?: ID; // The comment's user creator ID
}

export interface ICommentCreateInput
	extends IBasePerTenantAndOrganizationEntityModel,
		IBasePerEntityType,
		IMentionEmployeeIds {
	comment: string;
	parentId?: ID;
	members?: IEmployee[];
	teams?: IOrganizationTeam[];
}

export interface ICommentUpdateInput
	extends IMentionEmployeeIds,
		Partial<Omit<IComment, 'entity' | 'entityId' | 'createdById' | 'createdBy' | 'employeeId' | 'employee'>> {}

export interface ICommentFindInput extends Pick<IComment, 'entity' | 'entityId'> {}
