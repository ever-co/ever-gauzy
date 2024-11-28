import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee, IMemberEntityBased } from './employee.model';
import { IOrganizationProjectEmployee, IRelationalOrganizationProject } from './organization-projects.model';
import { IOrganizationSprint } from './organization-sprint.model';
import { IOrganizationTeam } from './organization-team.model';
import { ITask } from './task.model';
import { IUser } from './user.model';

export interface IRelationalOrganizationProjectModule {
	projectModule?: IOrganizationProjectModule;
	projectModuleId?: ID;
}

export interface IOrganizationProjectModule
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationProject {
	name: string;
	description?: string;
	status?: ProjectModuleStatusEnum;
	startDate?: Date;
	endDate?: Date;
	isFavorite?: boolean;
	public?: boolean;
	parent?: IOrganizationProjectModule;
	parentId?: ID; // Optional field for specifying the parent module ID
	children?: IOrganizationProjectModule[]; // Modules related as children
	creator?: IUser;
	creatorId?: ID;
	members?: IOrganizationProjectEmployee[];
	organizationSprints?: IOrganizationSprint[];
	teams?: IOrganizationTeam[];
	tasks?: ITask[];
}

export interface IOrganizationProjectModuleFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Partial<Pick<IOrganizationProjectModule, 'name' | 'status' | 'projectId'>> {
	organizationTeamId?: ID;
	organizationSprintId?: ID;
}

export enum ProjectModuleStatusEnum {
	BACKLOG = 'backlog',
	PLANNED = 'planned',
	IN_PROGRESS = 'in-progress',
	PAUSED = 'paused',
	COMPLETED = 'completed',
	CANCELLED = 'cancelled'
}

export interface IOrganizationProjectModuleCreateInput
	extends Omit<IOrganizationProjectModule, 'id'>,
		IMemberEntityBased {}

export interface IOrganizationProjectModuleUpdateInput extends Partial<IOrganizationProjectModuleCreateInput> {}
