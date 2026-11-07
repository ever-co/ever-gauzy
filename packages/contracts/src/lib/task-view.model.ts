import { IBasePerTenantAndOrganizationEntityModel, JsonData, ID } from './base-entity.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IRelationalOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationProjectModule } from './organization-project-module.model';
import { IRelationalOrganizationSprint } from './organization-sprint.model';

/** Who sees a saved view: its creator only, or everyone the view's scope (team, project, organization) reaches. */
export enum TaskViewVisibilityEnum {
	PERSONAL = 'personal',
	SHARED = 'shared'
}

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
	/** Personal views are listed to their creator only; absent means shared. */
	visibility?: TaskViewVisibilityEnum;
	/** Bumped by every save; an update may state the version it read (`expectedVersion`) and is refused when stale. */
	version?: number;
	/** The task ids in the order the view shows them when its ordering is manual. */
	manualOrder?: ID[];
}

export interface ITaskView extends ITaskViewBase {
	name: string; // Ensure name is always defined
}

export interface ITaskViewCreateInput extends ITaskViewBase {}

export interface ITaskViewUpdateInput extends ITaskViewCreateInput {
	/** The version the client read; the update is refused (409) when the view moved on since. */
	expectedVersion?: number;
}

/** `PUT /task-views/:id/order`: the tasks in the order the view shows them. */
export interface ITaskViewOrderInput extends IBasePerTenantAndOrganizationEntityModel {
	taskIds: ID[];
	expectedVersion?: number;
}

export enum VisibilityLevelEnum {
	MODULE_AND_SPRINT = 0,
	TEAM_AND_PROJECT = 1,
	ORGANIZATION = 2,
	WORKSPACE = 3
}
