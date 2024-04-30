import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRelationalEmployee } from './employee.model';
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

export interface IDailyPlan extends IDailyPlanBase, IRelationalEmployee {
	tasks?: ITask[];
}

export interface IDailyPlanCreateInput extends IDailyPlanBase, IRelationalEmployee {
	taskId?: ITask['id'];
}

export interface IDailyPlanUpdateInput extends Partial<IDailyPlanBase> { }
