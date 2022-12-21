import { IEmployee } from 'employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationTeamEmployee } from './organization-team-employee-model';
import { ITag } from './tag-entity.model';
import { ITask } from './task.model';
import { ITimerStatusInput } from './timesheet.model';

export interface IOrganizationTeam extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	prefix?: string;
	members?: IOrganizationTeamEmployee[];
	managers?: IOrganizationTeamEmployee[];
	tags?: ITag[];
	tasks?: ITask[];
}

export interface IOrganizationTeamFindInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	prefix?: string;
	employeeId?: IEmployee['id'];
}

export interface IOrganizationTeamCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	prefix?: string;
	memberIds?: string[];
	managerIds?: string[];
	tags?: ITag[];
}

export interface IOrganizationTeamUpdateInput extends Partial<IOrganizationTeamCreateInput> {
	id: string
}

export interface IOrganizationTeamStatisticInput extends ITimerStatusInput {
	withLaskWorkedTask: boolean;
}