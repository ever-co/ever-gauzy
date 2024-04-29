import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRelationalEmployee } from './employee.model';
import { ITask } from './task.model';

export interface IDailyPlan extends IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee {
	date: Date;
	workTimePlanned: number;
	status: DailyPlanStatusEnum;
	tasks?: ITask[];
}

export enum DailyPlanStatusEnum {
	OPEN = 'open',
	IN_PROGRESS = 'in-progress',
	COMPLETED = 'completed'
}

export interface IDailyPlanCreateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee {
	date: Date;
	workTimePlanned: number;
	status: DailyPlanStatusEnum;
	taskId?: ITask['id'];
}

export interface IDailyPlanUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	date?: Date;
	workTimePlanned?: number;
	status?: DailyPlanStatusEnum;
}
