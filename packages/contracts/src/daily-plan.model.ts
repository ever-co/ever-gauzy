import { IRelationalOrganizationTeam } from './organization-team.model';
import { IBasePerTenantAndOrganizationEntityModel, IBaseRelationsEntityModel, ID } from './base-entity.model';
import { IEmployeeEntityInput } from './employee.model';
import { ITask } from './task.model';

export enum DailyPlanStatusEnum {
	OPEN = 'open',
	IN_PROGRESS = 'in-progress',
	COMPLETED = 'completed'
}

export interface IDailyPlanBase extends IBasePerTenantAndOrganizationEntityModel {
	date: Date;
	workTimePlanned: number;
	status: DailyPlanStatusEnum;
}

export interface IDailyPlan extends IDailyPlanBase, IEmployeeEntityInput, IRelationalOrganizationTeam {
	tasks?: ITask[];
}

export interface IDailyPlanCreateInput extends IDailyPlanBase, IEmployeeEntityInput, IRelationalOrganizationTeam {
	taskId?: ID;
}

export interface IDailyPlanUpdateInput
	extends Partial<IDailyPlanBase>,
		Pick<IDailyPlanCreateInput, 'employeeId'>,
		Partial<Pick<IRelationalOrganizationTeam, 'organizationTeamId'>> {}

export interface IGetDailyPlansByTeamInput extends IBaseRelationsEntityModel, IBasePerTenantAndOrganizationEntityModel {
	teamIds?: ID[];
}

export interface IDailyPlanTasksUpdateInput
	extends Pick<IDailyPlanCreateInput, 'taskId' | 'employeeId'>,
		IBasePerTenantAndOrganizationEntityModel {}

// Interface for data type should be sent when need to delete a task from many daily plans
export interface IDailyPlansTasksUpdateInput
	extends Pick<IDailyPlanCreateInput, 'employeeId' | 'organizationTeamId'>,
		IBasePerTenantAndOrganizationEntityModel {
	plansIds: ID[];
}
