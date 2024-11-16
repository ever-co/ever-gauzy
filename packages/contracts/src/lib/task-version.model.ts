import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationTeam } from './organization-team.model';

export interface ITaskVersion
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

export interface ITaskVersionCreateInput
	extends Omit<ITaskVersion, 'isSystem'>,
		Omit<ITaskVersion, 'value'> {}

export interface ITaskVersionUpdateInput
	extends Partial<ITaskVersionCreateInput> {
	id?: string;
}

export interface ITaskVersionFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Pick<ITaskVersion, 'projectId' | 'organizationTeamId'> {}
