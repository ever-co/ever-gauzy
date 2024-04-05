import { IRelationalEmployee } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationTeamEmployee } from './organization-team-employee-model';
import { ITag } from './tag.model';
import { ITask } from './task.model';
import { ITimerStatusInput } from './timesheet.model';
import { IRelationalImageAsset } from './image-asset.model';
import { CrudActionEnum } from './organization.model';
import { IOrganizationProject } from './organization-projects.model';

export interface IOrganizationTeam extends IBasePerTenantAndOrganizationEntityModel, IRelationalImageAsset {
	name: string;
	color?: string;
	emoji?: string;
	teamSize?: string;
	logo?: string;
	prefix?: string;
	public?: boolean;
	profile_link?: string;
	members?: IOrganizationTeamEmployee[];
	managers?: IOrganizationTeamEmployee[];
	projects?: IOrganizationProject[];
	tags?: ITag[];
	tasks?: ITask[];
}

export interface IOrganizationTeamFindInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee {
	name?: string;
	prefix?: string;
	public?: boolean;
	profile_link?: string;
	members?: IOrganizationTeamEmployee;
}

export interface IOrganizationTeamCreateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalImageAsset {
	name: string;
	emoji?: string;
	teamSize?: string;
	color?: string;
	logo?: string;
	prefix?: string;
	public?: boolean;
	profile_link?: string;
	memberIds?: string[];
	managerIds?: string[];
	tags?: ITag[];
	projects?: IOrganizationProject[];
}

export interface IOrganizationTeamUpdateInput extends Partial<IOrganizationTeamCreateInput> {
	id: string;
	public?: boolean;
}

export interface IOrganizationTeamStatisticInput extends ITimerStatusInput {
	withLaskWorkedTask: boolean;
}

export interface IRelationalOrganizationTeam {
	organizationTeam?: IOrganizationTeam;
	organizationTeamId?: IOrganizationTeam['id'];
}

export interface IOrganizationTeamStoreState {
	team: IOrganizationTeam;
	action: CrudActionEnum;
}
