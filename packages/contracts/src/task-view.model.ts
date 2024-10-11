import { IBasePerTenantAndOrganizationEntityModel, JsonData } from './base-entity.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IRelationalOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationProjectModule } from './organization-project-module.model';
import { IRelationalOrganizationSprint } from './organization-sprint.model';

export interface ITaskViewBase
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationTeam,
		IRelationalOrganizationProject,
		IRelationalOrganizationProjectModule,
		IRelationalOrganizationSprint {
	name?: string;
	description?: string;
	visibilityLevel?: VisibilityLevelEnum;
	queryParams?: JsonData;
	filterOptions?: JsonData;
	displayOptions?: JsonData;
	properties?: Record<string, boolean>;
	isLocked?: boolean;
}

export interface ITaskView extends ITaskViewBase {
	name: string; // Ensure name is always defined
}

export interface ITaskViewCreateInput extends ITaskViewBase {}

export interface ITaskViewUpdateInput extends ITaskViewCreateInput {}

export enum VisibilityLevelEnum {
	MODULE_AND_SPRINT = 0,
	TEAM_AND_PROJECT = 1,
	ORGANIZATION = 2,
	WORKSPACE = 3
}
