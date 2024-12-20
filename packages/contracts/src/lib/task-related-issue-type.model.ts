import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationTeam } from './organization-team.model';

export interface ITaskRelatedIssueType
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationTeam {
	name: string;
	value: string;
	description?: string;
	icon?: string;
	color?: string;
	isSystem?: boolean;
	fullIconUrl?: string;
	project?: IOrganizationProject;
	projectId?: IOrganizationProject['id'];
}

export interface ITaskRelatedIssueTypeCreateInput
	extends Omit<ITaskRelatedIssueType, 'isSystem'>,
		Omit<ITaskRelatedIssueType, 'value'> {}

export interface ITaskRelatedIssueTypeUpdateInput
	extends Partial<ITaskRelatedIssueTypeCreateInput> {
	id?: string;
}

export interface ITaskRelatedIssueTypeFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<ITaskRelatedIssueType, 'projectId' | 'organizationTeamId'> {}
