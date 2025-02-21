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
import { IHasUserCreator } from './user.model';

// Base interface for common properties
interface IBaseTeamProperties extends IBasePerTenantAndOrganizationEntityModel, IRelationalImageAsset, ITaggable {
	name: string;
	color?: string;
	emoji?: string;
	teamSize?: string;
	logo?: string;
	prefix?: string;
	shareProfileView?: boolean; // Default is true
	requirePlanToTrack?: boolean; // Default is false
	public?: boolean;
	profile_link?: string;
}

// Interface for team members and related entities
interface ITeamAssociations {
	members?: IOrganizationTeamEmployee[];
	managers?: IOrganizationTeamEmployee[];
	projects?: IOrganizationProject[];
	modules?: IOrganizationProjectModule[];
	assignedComments?: IComment[];
	tasks?: ITask[];
}

// Main Organization Team interface
export interface IOrganizationTeam extends IBaseTeamProperties, ITeamAssociations, IHasUserCreator {}

// Input interface for finding an organization team
export interface IOrganizationTeamFindInput extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	name?: string;
	prefix?: string;
	public?: boolean;
	profile_link?: string;
	members?: IOrganizationTeamEmployee;
}

// Input interface for creating an organization team
export interface IOrganizationTeamCreateInput extends IBaseTeamProperties, IMemberEntityBased {
	projects?: IOrganizationProjectCreateInput[];
}

// Input interface for updating an organization team
export interface IOrganizationTeamUpdateInput extends Partial<IOrganizationTeamCreateInput> {}

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
