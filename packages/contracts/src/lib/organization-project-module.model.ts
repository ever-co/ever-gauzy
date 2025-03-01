import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IManagerAssignable } from './common.model';
import { IEmployeeEntityInput, IMemberEntityBased } from './employee.model';
import { IRelationalOrganizationProject } from './organization-projects.model';
import { IOrganizationSprint } from './organization-sprint.model';
import { IOrganizationTeam } from './organization-team.model';
import { IRelationalRole } from './role.model';
import { ITaskView } from './task-view.model';
import { ITask } from './task.model';

export enum ProjectModuleStatusEnum {
	BACKLOG = 'backlog',
	PLANNED = 'planned',
	IN_PROGRESS = 'in-progress',
	PAUSED = 'paused',
	COMPLETED = 'completed',
	CANCELLED = 'cancelled'
}

export interface IRelationalOrganizationProjectModule {
	projectModule?: IOrganizationProjectModule;
	projectModuleId?: ID;
}

interface IBaseProjectModuleProperties extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	description?: string;
	status?: ProjectModuleStatusEnum;
	startDate?: Date;
	endDate?: Date;
	isFavorite?: boolean;
	public?: boolean;
	parent?: IOrganizationProjectModule;
	parentId?: ID;
}

interface IProjectModuleAssociations extends IRelationalOrganizationProject {
	children?: IOrganizationProjectModule[];
	members?: IOrganizationProjectModuleEmployee[];
	organizationSprints?: IOrganizationSprint[];
	teams?: IOrganizationTeam[];
	tasks?: ITask[];
	views?: ITaskView[];
}

export interface IOrganizationProjectModule extends IBaseProjectModuleProperties, IProjectModuleAssociations {}

export interface IOrganizationProjectModuleFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Partial<Pick<IOrganizationProjectModule, 'name' | 'status' | 'projectId'>> {
	organizationTeamId?: ID;
	organizationSprintId?: ID;
}

export interface IOrganizationProjectModuleCreateInput
	extends Omit<IOrganizationProjectModule, 'id'>,
		IMemberEntityBased {}

export interface IOrganizationProjectModuleUpdateInput extends Partial<IOrganizationProjectModuleCreateInput> {}

export interface IOrganizationProjectModuleEmployee
	extends IBasePerTenantAndOrganizationEntityModel,
		IEmployeeEntityInput,
		IRelationalRole,
		IManagerAssignable {
	organizationProjectModule: IOrganizationProjectModule;
	organizationProjectModuleId: ID;
}
