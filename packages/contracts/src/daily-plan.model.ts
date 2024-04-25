import { IEmployee } from 'employee.model';

export interface IDailyPlan extends IEmployee {
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
