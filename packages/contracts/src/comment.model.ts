import { IUser } from 'user.model';
import { ActorTypeEnum, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IOrganizationTeam } from './organization-team.model';

export interface IComment extends IBasePerTenantAndOrganizationEntityModel {
	entity: CommentEntityEnum;
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

export enum CommentEntityEnum {
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
	Task = 'Task'
}

export interface ICommentCreateInput {
	comment: string;
	entity: CommentEntityEnum;
	entityId: ID;
	parentId?: ID;
	members?: IEmployee[];
	teams?: IOrganizationTeam[];
}

export interface ICommentUpdateInput extends Partial<Omit<IComment, 'entity' | 'entityId' | 'creatorId'>> {}

export interface ICommentFindInput extends Pick<IComment, 'entity' | 'entityId'> {}
