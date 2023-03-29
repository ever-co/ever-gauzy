import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRelationalImageAsset } from './image-asset.model';
import { IRelationalOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationTeam } from './organization-team.model';

export interface IIssueType
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationTeam,
		IRelationalOrganizationProject,
		IRelationalImageAsset {
	name: string;
	value: string;
	description?: string;
	icon?: string;
	color?: string;
	isSystem?: boolean;
	fullIconUrl?: string;
}

export interface IIssueTypeCreateInput extends Omit<IIssueType, 'isSystem'>, Omit<IIssueType, 'value'> {}

export interface IIssueTypeUpdateInput extends Partial<IIssueTypeCreateInput> {
	id?: string;
}

export interface IIssueTypeFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<IIssueType, 'projectId' | 'organizationTeamId'> {}
