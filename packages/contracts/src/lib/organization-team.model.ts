import { IEmployeeEntityInput, IMemberEntityBased } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IOrganizationTeamEmployee } from './organization-team-employee-model';
import { ITaggable } from './tag.model';
import { ITask } from './task.model';
import { ITimerStatusInput } from './timesheet.model';
import { IRelationalImageAsset } from './image-asset.model';
import { CrudActionEnum } from './organization.model';
import { IOrganizationProject, IOrganizationProjectCreateInput } from './organization-projects.model';
import { IOrganizationProjectModule } from './organization-project-module.model';
import { IComment } from './comment.model';

export interface IOrganizationTeam extends IBasePerTenantAndOrganizationEntityModel, IRelationalImageAsset, ITaggable {
	name: string;
	color?: string;
	emoji?: string;
	teamSize?: string;
	logo?: string;
	prefix?: string;
	shareProfileView?: boolean; // If true, all members can view "Worked" tasks and "Daily Plan" tabs of all other employees, By default, it's true
	requirePlanToTrack?: boolean; // If true, members can't be able to track time without have a "Daily Plan". By default, it's false
	public?: boolean;
	profile_link?: string;
	members?: IOrganizationTeamEmployee[];
	managers?: IOrganizationTeamEmployee[];
	projects?: IOrganizationProject[];
	modules?: IOrganizationProjectModule[];
	assignedComments?: IComment[];
	tasks?: ITask[];
}

export interface IOrganizationTeamFindInput extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	name?: string;
	prefix?: string;
	public?: boolean;
	profile_link?: string;
	members?: IOrganizationTeamEmployee;
}

export interface IOrganizationTeamCreateInput
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalImageAsset,
		IMemberEntityBased,
		ITaggable {
	name: string;
	emoji?: string;
	teamSize?: string;
	color?: string;
	logo?: string;
	prefix?: string;
	shareProfileView?: boolean;
	requirePlanToTrack?: boolean;
	public?: boolean;
	profile_link?: string;
	projects?: IOrganizationProjectCreateInput[];
}

export interface IOrganizationTeamUpdateInput extends Partial<IOrganizationTeamCreateInput> {
	shareProfileView?: boolean;
	requirePlanToTrack?: boolean;
	public?: boolean;
}

export interface IOrganizationTeamStatisticInput extends ITimerStatusInput {
	withLastWorkedTask: boolean;
}

export interface IRelationalOrganizationTeam {
	organizationTeam?: IOrganizationTeam;
	organizationTeamId?: ID;
}

export interface IOrganizationTeamStoreState {
	team: IOrganizationTeam;
	action: CrudActionEnum;
}