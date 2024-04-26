import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IDailyPlan } from './daily-plan.model';
import { ITask } from './task.model';

export interface IDailyPlanTask extends IBasePerTenantAndOrganizationEntityModel {
	dailyPlan: IDailyPlan;
	dailyPlanId: IDailyPlan['id'];
	task: ITask;
	taskId: ITask['id'];
}
