import { ActorTypeEnum, IBasePerEntityType, ID } from './base-entity.model';
import { IEmployee, IEmployeeEntityInput as ICommentAuthor } from './employee.model';
import { IOrganizationTeam } from './organization-team.model';
import { IMentionEmployeeIds } from './mention.model';

export interface IComment extends IBasePerEntityType, ICommentAuthor {
	comment: string;
	actorType?: ActorTypeEnum;
	resolved?: boolean;
	resolvedAt?: Date;
	editedAt?: Date;
	members?: IEmployee[]; // Indicates members assigned to comment
	teams?: IOrganizationTeam[]; // Indicates teams assigned to comment
	parent?: IComment;
	parentId?: ID; // Specify the parent comment if current one is a reply
	replies?: IComment[];
	resolvedBy?: IEmployee; // Indicates the employee who resolved the comment
	resolvedById?: ID; // Indicates the employee ID who resolved the comment
}

export interface ICommentCreateInput extends IBasePerEntityType, IMentionEmployeeIds {
	comment: string;
	entityName?: string;
	parent?: IComment;
	parentId?: ID; // Specify the parent comment if current one is a reply
	members?: IEmployee[];
	teams?: IOrganizationTeam[];
}

export interface ICommentUpdateInput
	extends IMentionEmployeeIds,
		Partial<Omit<IComment, 'entity' | 'entityId' | 'employeeId' | 'employee'>> {}

export interface ICommentFindInput extends Pick<IComment, 'entity' | 'entityId'> {}
