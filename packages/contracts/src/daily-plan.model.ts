import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';

export interface IDailyPlan extends IBasePerTenantAndOrganizationEntityModel {
	date: Date;
	workTimePlanned: Date;
	status: DailyPlanStatusEnum;
	employee?: IEmployee;
	employeeId?: IEmployee['id'];
}

export enum DailyPlanStatusEnum {
	OPEN = 'open',
	IN_PROGRESS = 'in-progress',
	COMPLETED = 'completed'
}
