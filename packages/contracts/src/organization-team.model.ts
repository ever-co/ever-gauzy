import { IRelationalEmployee } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationTeamEmployee } from './organization-team-employee-model';
import { ITag } from './tag.model';
import { ITask } from './task.model';
import { ITimerStatusInput } from './timesheet.model';
import { IRelationalImageAsset } from './image-asset.model';

export interface IOrganizationTeam extends IBasePerTenantAndOrganizationEntityModel, IRelationalImageAsset {
	name: string;
	logo: string;
	prefix?: string;
	public?: boolean;
	profile_link?: string;
	members?: IOrganizationTeamEmployee[];
	managers?: IOrganizationTeamEmployee[];
	tags?: ITag[];
	tasks?: ITask[];
}

export interface IOrganizationTeamFindInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee {
	name?: string;
	prefix?: string;
	public?: boolean;
	profile_link?: string;
}

export interface IOrganizationTeamCreateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalImageAsset {
	name: string;
	logo?: string;
	prefix?: string;
	public?: boolean;
	profile_link?: string;
	memberIds?: string[];
	managerIds?: string[];
	tags?: ITag[];
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
